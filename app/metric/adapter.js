import ENV from 'screwdriver-ui/config/environment';
import BaseAdapter from 'screwdriver-ui/application/adapter';
import { pluralize } from 'ember-inflector';

export default BaseAdapter.extend({
  /**
   * Overriding default adapter in order to query metrics api.
   * @return {String} url
   */
  urlForQuery(query, modelName) {
    console.log('here urlForQuery');
    const { pipelineId, jobId } = query;

    delete query.pipelineId;

    return `${ENV.APP.SDAPI_HOSTNAME}/${
      ENV.APP.SDAPI_NAMESPACE
    }/pipelines/${pipelineId}/${pluralize(modelName)}`;
  },
  findHasMany(store, snapshot, url, relationship) {
    console.log('here findHasMany');

    return this._super(...arguments);
  },
  findRecord(store, type, id, snapshot) {
    console.log('here findRecord');

    return this._super(...arguments);
    // return this.ajax(url, 'GET');
  },
  insertLink(key, o) {
    console.log('here insertLink');

    return this._super(...arguments);
  },
  handleResponse() {
    console.log('here handleResponse');

    return this._super(...arguments);
  },
  decoratePayload() {
    console.log('here decoratePayload');

    return this._super(...arguments);
  },
  urlForFindRecord(id, modelName, snapshot) {
    console.log('here urlForFindRecord');

    let baseUrl = this.buildURL(modelName, id, snapshot);
    // return `${baseUrl}/users/${snapshot.adapterOptions.user_id}/playlists/${id}`;

    return this._super(...arguments);
  },
  urlForFindAll() {
    console.log('here urlForFindAll');

    return this._super(...arguments);
  },
  urlForCreateRecord() {
    console.log('here urlForCreateRecord');

    return this._super(...arguments);
  },
  urlForUpdateRecord() {
    console.log('here urlForUpdateRecord');

    return this._super(...arguments);
  },
  urlForDeleteRecord() {
    console.log('here urlForDeleteRecord');

    return this._super(...arguments);
  },
  ajax(url, type, options) {
    console.log('here ajax');

    if (options) {
      options.traditional = true;
    }

    console.log('options', options);

    return this._super(...arguments);
  }
});
