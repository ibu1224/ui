import ENV from 'screwdriver-ui/config/environment';
import BaseAdapter from 'screwdriver-ui/application/adapter';
import { pluralize } from 'ember-inflector';

export default BaseAdapter.extend({
  findHasMany(store, snapshot, url, relationship) {
    console.log('here findHasMany');
    // return this._super(...arguments);

    if (relationship.type == 'metrics') {
      const qp = 'count=20&page=1'; // queryString.stringify(snapshot.record.get('query-params'));

      url += `?${qp}`;

      return this.ajax(url, 'GET');
    }

    return this._super(...arguments);

    // },
    // insertLink(key, o) {
    //   console.log('here insertLink');
    //   return this._super(...arguments);
    // },
    // handleResponse() {
    //   console.log('here handleResponse');

    //   return this._super(...arguments);
    // },
    // decoratePayload() {
    //   console.log('here decoratePayload');
    //   return this._super(...arguments);
    // },
    // urlForFindAll() {
    //   console.log('here urlForFindAll');
    //   return this._super(...arguments);
    // },
    // urlForCreateRecord(){
    //   console.log('here urlForCreateRecord');
    //   return this._super(...arguments);
    // },
    // urlForUpdateRecord() {
    //   console.log('here urlForUpdateRecord');
    //   return this._super(...arguments);
    // },
    // urlForDeleteRecord() {
    //   console.log('here urlForDeleteRecord');

    //   return this._super(...arguments);
    // },
    // ajax(url, type, options) {
    //   console.log('here ajax');

    //   if (options) {
    //     options.traditional = true;
    //   }

    //   return this._super(...arguments);
  }
});
