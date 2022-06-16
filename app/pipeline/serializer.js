import { assign } from '@ember/polyfills';
import DS from 'ember-data';
import { sortWorkflowGraph } from '../event/serializer';

export default DS.RESTSerializer.extend({
  normalizeResponse(store, typeClass, payload, id, requestType) {
    console.log('here, pipeline serializer normalizeResponse');

    // if (requestType.toString() === 'metric') {
    //    payload.links = { metrics: 'metrics' };
    //    return { card: payload };
    //  }

    const { pipeline } = payload;

    if (pipeline && pipeline.workflowGraph) {
      sortWorkflowGraph(pipeline.workflowGraph);
    }

    return this._super(store, typeClass, payload, id, requestType);
  },

  /**
   * Override the serializeIntoHash
   * See http://emberjs.com/api/data/classes/DS.RESTSerializer.html#method_serializeIntoHash
   * @method serializeIntoHash
   */
  serializeIntoHash(hash, typeClass, snapshot) {
    console.log('here, pipeline serializer serializeIntoHash');

    return assign(hash, {
      checkoutUrl: snapshot.attr('checkoutUrl'),
      rootDir: snapshot.attr('rootDir') || '',
      autoKeysGeneration: snapshot.attr('autoKeysGeneration') || false
    });
  }
});
