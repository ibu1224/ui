import Route from '@ember/routing/route';

export default Route.extend({
  model() {
    // return parent route model
    return this.modelFor('pipeline.build');
  },
  actions: {
    didTransition() {
      this.controllerFor('pipeline.build').setProperties({
        selectedArtifact: '',
        activeTab: 'steps'
      });
    },
    error(error) {
      if (error && Array.isArray(error.errors)) {
        this.transitionTo('/404');
      }

      return false;
    }
  }
});
