'use strict';

const { exec } = require('node:child_process');

const DEFAULT_DELAY_MS = 1500;

let timeoutId = null;
let buildRunning = false;
let rerunRequested = false;
let queuedReasons = [];

function getDelayMs() {
  const parsed = Number.parseInt(process.env.SITE_BUILD_HOOK_DELAY_MS || '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_DELAY_MS;
}

function getBuildTriggerConfig() {
  return {
    command: process.env.SITE_BUILD_HOOK_COMMAND,
    token: process.env.SITE_BUILD_HOOK_TOKEN,
    url: process.env.SITE_BUILD_HOOK_URL,
  };
}

function summarizeReasons(reasons) {
  return reasons.map((reason) => ({
    action: reason.action,
    documentId: reason.documentId || null,
    locale: reason.locale || null,
    uid: reason.uid,
  }));
}

function runCommand(strapi, command) {
  return new Promise((resolve, reject) => {
    exec(command, { env: process.env }, (error, stdout, stderr) => {
      if (stdout?.trim()) {
        strapi.log.info(`[site-build-trigger] stdout: ${stdout.trim()}`);
      }

      if (stderr?.trim()) {
        strapi.log.warn(`[site-build-trigger] stderr: ${stderr.trim()}`);
      }

      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function callWebhook(strapi, url, token, reasons) {
  const headers = {
    'content-type': 'application/json',
  };

  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reasons }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Webhook failed with ${response.status}: ${body}`);
  }

  strapi.log.info(`[site-build-trigger] webhook sent: ${url}`);
}

async function executeTriggers(strapi, reasons) {
  const { command, token, url } = getBuildTriggerConfig();

  if (!url && !command) {
    strapi.log.info('[site-build-trigger] skipped: no hook configured');
    return;
  }

  if (url) {
    await callWebhook(strapi, url, token, summarizeReasons(reasons));
  }

  if (command) {
    await runCommand(strapi, command);
  }
}

async function flushQueue(strapi) {
  if (buildRunning) {
    rerunRequested = true;
    return;
  }

  const reasons = queuedReasons;
  queuedReasons = [];
  buildRunning = true;

  try {
    await executeTriggers(strapi, reasons);
  } catch (error) {
    strapi.log.error('[site-build-trigger] failed', error);
  } finally {
    buildRunning = false;

    if (rerunRequested || queuedReasons.length > 0) {
      rerunRequested = false;
      scheduleSiteBuild(strapi, {
        action: 'coalesced',
        uid: 'internal::site-build-trigger',
      });
    }
  }
}

function scheduleSiteBuild(strapi, reason) {
  queuedReasons.push(reason);

  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  timeoutId = setTimeout(() => {
    timeoutId = null;
    void flushQueue(strapi);
  }, getDelayMs());
}

module.exports = {
  scheduleSiteBuild,
};
