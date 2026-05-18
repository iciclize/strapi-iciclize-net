'use strict';

const { scheduleSiteBuild } = require('./utils/site-build-trigger');

const SITE_SYNC_ACTIONS = {
  'api::article.article': new Set(['create', 'update', 'delete', 'publish', 'unpublish']),
  'api::profile.profile': new Set(['create', 'update', 'delete', 'publish', 'unpublish']),
  'api::tag.tag': new Set(['create', 'update', 'delete']),
};

function pickResultDocument(result) {
  return Array.isArray(result) ? result[0] : result;
}

function isPublished(document) {
  return Boolean(document && typeof document === 'object' && document.publishedAt);
}

function shouldTriggerSiteSync(context, result) {
  const allowedActions = SITE_SYNC_ACTIONS[context.uid];
  if (!allowedActions?.has(context.action)) {
    return false;
  }

  if (context.uid === 'api::tag.tag') {
    return true;
  }

  if (context.action === 'delete' || context.action === 'publish' || context.action === 'unpublish') {
    return true;
  }

  const requestedStatus =
    context.params?.status ||
    context.params?.data?.status ||
    context.params?.data?.publishedAt;

  if (requestedStatus === 'draft') {
    return false;
  }

  return isPublished(pickResultDocument(result)) || requestedStatus === 'published';
}

function buildReason(context, result) {
  const document = pickResultDocument(result);

  return {
    action: context.action,
    documentId: document?.documentId || context.params?.documentId || null,
    locale: context.params?.locale || document?.locale || null,
    uid: context.uid,
  };
}

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }) {
    strapi.documents.use(async (context, next) => {
      const result = await next();

      if (shouldTriggerSiteSync(context, result)) {
        scheduleSiteBuild(strapi, buildReason(context, result));
      }

      return result;
    });
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap(/*{ strapi }*/) {},
};
