import classic from 'ember-classic-decorator';
import { computed } from '@ember/object';
import Controller from '@ember/controller';

@classic
export default class CommandsController extends Controller {
  @computed('model')
  get routeParams() {
    let route = this.model;

    let params = {
      ...route.paramsFor('commands.namespace'),
      ...route.paramsFor('commands.detail')
    };

    return params;
  }

  @computed('routeParams')
  get crumbs() {
    let breadcrumbs = [];

    let params = this.routeParams;

    if (params.namespace || params.detail) {
      breadcrumbs.push({
        name: 'Commands',
        params: ['commands']
      });
    }

    if (params.namespace) {
      breadcrumbs.push({
        name: params.namespace,
        params: ['commands.namespace', params.namespace]
      });
    }

    if (params.name) {
      breadcrumbs.push({
        name: params.name,
        params: ['commands.detail', params.namespace, params.name]
      });
    }

    return breadcrumbs;
  }
}
