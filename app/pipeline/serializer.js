import classic from 'ember-classic-decorator';
import RESTSerializer from '@ember-data/serializer/rest';
import { assign } from '@ember/polyfills';
import { sortWorkflowGraph } from '../event/serializer';

@classic
export default class Serializer extends RESTSerializer {
  normalizeResponse(store, typeClass, payload, id, requestType) {
    const { pipeline } = payload;

    if (pipeline && pipeline.workflowGraph) {
      sortWorkflowGraph(pipeline.workflowGraph);
    }

    return super.normalizeResponse(store, typeClass, payload, id, requestType);
  }

  /**
   * Override the serializeIntoHash
   * See http://emberjs.com/api/data/classes/DS.RESTSerializer.html#method_serializeIntoHash
   * @method serializeIntoHash
   */
  serializeIntoHash(hash, typeClass, snapshot) {
    return assign(hash, {
      checkoutUrl: snapshot.attr('checkoutUrl'),
      rootDir: snapshot.attr('rootDir') || '',
      autoKeysGeneration: snapshot.attr('autoKeysGeneration') || false
    });
  }
}
