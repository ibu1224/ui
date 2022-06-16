import { assign } from '@ember/polyfills';
import DS from 'ember-data';

export default DS.RESTSerializer.extend({
  normalizeResponse(store, typeClass, payload, id, requestType) {
    console.log('here, metric serializer normalizeResponse');
    console.log(
      'typeClass',
      typeClass,
      'requestType',
      requestType,
      'payload',
      payload
    );

    // if (requestType.toString() === 'metric') {
    //    payload.links = { metrics: 'metrics' };
    //    return { card: payload };
    //  }

    // if (requestType === 'findRecord') {
    //   payload.collection.pipelines.forEach(p=>{
    //     // p.metrics = [23212375];
    //     p.metrics = [];
    //   })
    // }
    // const { pipeline } = payload;

    // if (pipeline && pipeline.workflowGraph) {
    //   sortWorkflowGraph(pipeline.workflowGraph);
    // }

    return this._super(store, typeClass, payload, id, requestType);
  },

  /**
   * Override the serializeIntoHash
   * See http://emberjs.com/api/data/classes/DS.RESTSerializer.html#method_serializeIntoHash
   * @method serializeIntoHash
   */
  serializeIntoHash(hash, typeClass, snapshot) {
    const dirty = snapshot.changedAttributes();

    Object.keys(dirty).forEach(key => {
      dirty[key] = dirty[key][1];
    });

    return assign(hash, dirty);
  }
});
