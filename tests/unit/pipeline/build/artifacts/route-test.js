import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';
import { run } from '@ember/runloop';
import EmberObject from '@ember/object';
import sinonTest from 'ember-sinon-qunit/test-support/test';

module('Unit | Route | pipeline/build/artifacts', function (hooks) {
  setupTest(hooks);

  test('it exists', function (assert) {
    let route = this.owner.lookup('route:pipeline/build/artifacts');

    assert.ok(route);
  });

  sinonTest('its activetTab is artifacts', function (assert) {
    assert.expect(2);
    const route = this.owner.lookup('route:pipeline/build/artifacts');
    const parentController = EmberObject.create({ activeTab: false });

    route.controllerFor = controllerName => {
      assert.equal(
        controllerName,
        'pipeline.build',
        'pipeline.build controller invoked'
      );

      if (controllerName === 'pipeline.build') {
        return parentController;
      }

      return '';
    };

    run(() => {
      route.send('didTransition');
      assert.equal(parentController.get('activeTab'), 'artifacts');
    });
  });
});
