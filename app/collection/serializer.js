import { assign } from '@ember/polyfills';
import DS from 'ember-data';
import { EmbeddedRecordsMixin } from '@ember-data/serializer/rest';

export default DS.RESTSerializer.extend(EmbeddedRecordsMixin, {
  attrs: {
    pipelines: { embedded: 'always' }
  },

  // normalizePayload() {
  //   console.log('here, collection serializer normalizePayload');
  // }
  normalizeResponse(store, typeClass, payload, id, requestType) {
    console.log('here, collection serializer normalizeResponse');
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

    if (requestType === 'findRecord') {
      payload.collection.pipelines.forEach(p => {
        // p.metrics = [23212375];
        // p.metrics = [23212375, 23212374];
        p.links = {
          metrics: `/v4/pipelines/${p.id}/metrics?count=20&page=1`
        };
      });

      console.log('updated payload collection', payload.collection);
    }
    // const { pipeline } = payload;

    // if (pipeline && pipeline.workflowGraph) {
    //   sortWorkflowGraph(pipeline.workflowGraph);
    // }

    return this._super(store, typeClass, payload, id, requestType);
  },
  /**
   * Override the serializeIntoHash method
   * See http://emberjs.com/api/data/classes/DS.RESTSerializer.html#method_serializeIntoHash
   * @method serializeIntoHash
   */
  serializeIntoHash(hash, typeClass, snapshot) {
    console.log('here, collection serializer serializeIntoHash');

    const dirty = snapshot.changedAttributes();

    Object.keys(dirty).forEach(key => {
      dirty[key] = dirty[key][1];
    });

    const h = assign(hash, dirty);

    return h;
  }
});
