import { inject as service } from '@ember/service';
import { alias } from '@ember/object/computed';

import Controller from '@ember/controller';

export default Controller.extend({
  session: service('session'),
  pipeline: alias('model.pipeline'),
  collections: alias('model.collections'),
  actions: {
    addToCollection(pipelineId, collection) {
      const { pipelineIds } = collection;

      if (!pipelineIds.includes(pipelineId)) {
        collection.set('pipelineIds', [...pipelineIds, pipelineId]);
      }

      return collection.save();
    },
    setJobStatus(id, state, stateChangeMessage) {
      const job = this.store.peekRecord('job', id);

      job.set('state', state);
      job.set('stateChangeMessage', stateChangeMessage);
      job
        .save()
        .catch(error => this.set('errorMessage', error.errors[0].detail || ''));
    }
  }
});
