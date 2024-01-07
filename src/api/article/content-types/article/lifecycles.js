'use strict';

const exec = require('child_process').exec;

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  async afterCreate(entry) {
    exec('ts /home/ice/gatsby-build.sh')
  },
  async afterUpdate(result, params, entry) {
    exec('ts /home/ice/gatsby-build.sh')
  },
  async afterDelete(result, params) {
    exec('ts /home/ice/gatsby-build.sh')
  },
};
