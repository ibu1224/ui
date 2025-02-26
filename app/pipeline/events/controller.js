import Controller, { inject } from '@ember/controller';
import { computed, get } from '@ember/object';
import { alias } from '@ember/object/computed';
import { inject as service } from '@ember/service';
import { jwt_decode as decoder } from 'ember-cli-jwt-decode';
import uniqBy from 'lodash.uniqby';
import moment from 'moment';
import ENV from 'screwdriver-ui/config/environment';
import ModelReloaderMixin from 'screwdriver-ui/mixins/model-reloader';
import { isPRJob } from 'screwdriver-ui/utils/build';
import {
  SHOULD_RELOAD_SKIP,
  SHOULD_RELOAD_YES
} from '../../mixins/model-reloader';

// eslint-disable-next-line require-jsdoc
export async function stopBuild(givenEvent, job) {
  const buildId = get(job, 'buildId');

  let build;

  let event = givenEvent;

  if (buildId) {
    build = this.store.peekRecord('build', buildId);
    build.set('status', 'ABORTED');

    if (!event && this.modelEvents) {
      event = this.modelEvents.filter(e => e.id === get(build, 'eventId'));
    }

    try {
      await build.save();
      if (this.refreshListViewJobs) {
        await this.refreshListViewJobs();
      }

      if (event) {
        event.hasMany('builds').reload();
      }
    } catch (e) {
      this.set(
        'errorMessage',
        Array.isArray(e.errors) ? e.errors[0].detail : ''
      );
    }
  }
}

// eslint-disable-next-line require-jsdoc
export async function startDetachedBuild(job, options = {}) {
  this.set('isShowingModal', true);

  let event = this.selectedEventObj;

  let parentBuildId = null;

  const buildId = get(job, 'buildId');
  const { parameters, reason } = options;

  if (buildId) {
    const build = this.store.peekRecord('build', buildId);

    parentBuildId = get(build, 'parentBuildId');
  } else if (event === undefined) {
    const builds = await get(job, 'builds');
    const latestBuild = get(builds, 'firstObject');

    event = await this.store.findRecord('event', get(latestBuild, 'eventId'));
  }

  const parentEventId = get(event, 'id');
  const groupEventId = get(event, 'groupEventId');
  const pipelineId = get(this, 'pipeline.id');
  const token = get(this, 'session.data.authenticated.token');
  const user = get(decoder(token), 'username');

  let causeMessage = `Manually started by ${user}`;
  const prNum = get(event, 'prNum');

  let startFrom = get(job, 'name');

  if (reason) {
    causeMessage = `[force start]${reason}`;
  }

  if (prNum) {
    // PR-<num>: prefix is needed, if it is a PR event.
    startFrom = `PR-${prNum}:${startFrom}`;
  }

  const eventPayload = {
    buildId,
    pipelineId,
    startFrom,
    parentBuildId,
    parentEventId,
    groupEventId,
    causeMessage
  };

  if (parameters) {
    eventPayload.meta = { parameters };
  }

  await this.createEvent(eventPayload, true);
}

// eslint-disable-next-line require-jsdoc
export async function createEvent(eventPayload, toActiveTab) {
  const newEvent = this.store.createRecord('event', eventPayload);

  try {
    await newEvent.save();
    if (this.refreshListViewJobs) {
      await this.refreshListViewJobs();
    }

    this.set('isShowingModal', false);
    this.forceReload();

    if (typeof toActiveTab === `boolean`) {
      if (toActiveTab) {
        const path = `pipeline/${newEvent.get('pipelineId')}/${this.activeTab}`;

        return this.transitionToRoute(path);
      }

      return this.transitionToRoute('pipeline', newEvent.get('pipelineId'));
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log('***** error', e);
    this.set('isShowingModal', false);
    this.set('errorMessage', Array.isArray(e.errors) ? e.errors[0].detail : '');
  } finally {
    await this.reload();
  }

  return null;
}

// eslint-disable-next-line require-jsdoc
export async function updateEvents(page) {
  if (this.currentEventType === 'pr') {
    return null;
  }

  this.set('isFetching', true);

  const events = await this.store.query('event', {
    pipelineId: get(this, 'pipeline.id'),
    page,
    count: ENV.APP.NUM_EVENTS_LISTED
  });
  const nextEvents = events.toArray();

  if (Array.isArray(nextEvents)) {
    if (nextEvents.length < ENV.APP.NUM_EVENTS_LISTED) {
      this.set('moreToShow', false);
    }

    this.set('eventsPage', page);
    this.set('isFetching', false);

    // Skip duplicate ones if new events got added to the head of the events list
    const noDuplicateEvents = nextEvents.filter(
      nextEvent => !this.paginateEvents.findBy('id', nextEvent.id)
    );

    this.paginateEvents.pushObjects(noDuplicateEvents);
  }

  return null;
}

export default Controller.extend(ModelReloaderMixin, {
  pipelineController: inject('pipeline'),
  shuttle: service(),
  lastRefreshed: moment(),
  expandedEventsGroup: {},
  shouldReload(model) {
    let res = SHOULD_RELOAD_SKIP;

    if (this.isDestroyed || this.isDestroying) {
      const event = model.events.find(m => m.isRunning);

      let diff;
      const lastRefreshed = this.get('lastRefreshed');

      if (event) {
        res = SHOULD_RELOAD_YES;
      } else {
        diff = moment().diff(lastRefreshed, 'milliseconds');
        if (diff > this.reloadTimeout * 2) {
          res = SHOULD_RELOAD_YES;
        } else {
          res = SHOULD_RELOAD_SKIP;
        }
      }
    }

    return res;
  },
  queryParams: [
    {
      jobId: { type: 'string' }
    }
  ],
  jobId: '',
  session: service(),
  stop: service('event-stop'),
  sync: service(),
  init() {
    this._super(...arguments);
    this.startReloading();
    this.set('eventsPage', 1);
  },
  showListView: false,
  showPRJobs: true,

  reload() {
    try {
      this.send('refreshModel');
    } catch (e) {
      return Promise.resolve(e);
    } finally {
      this.set('lastRefreshed', moment());
    }

    return Promise.resolve();
  },
  isShowingModal: false,
  isFetching: false,
  activeTab: 'events',
  moreToShow: true,
  errorMessage: '',
  jobs: computed('model.jobs', {
    get() {
      const jobs = this.getWithDefault('model.jobs', []);

      return jobs.filter(j => !isPRJob(j.get('name')));
    }
  }),
  jobIds: computed('pipeline.jobs', {
    get() {
      return this.get('pipeline.jobs')
        .filter(j => !isPRJob(j.get('name')))
        .map(j => j.id);
    }
  }),
  hasAdmins: computed('pipeline.admins', 'numberOfAdmins', {
    get() {
      const admins = this.getWithDefault('pipeline.admins', {});

      return Object.keys(admins).length;
    }
  }),
  jobsDetails: [],
  paginateEvents: [],
  prChainEnabled: alias('pipeline.prChain'),
  completeWorkflowGraph: computed('model.triggers.@each.triggers', {
    get() {
      const workflowGraph = this.get('pipeline.workflowGraph');
      const triggers = this.get('model.triggers');
      const completeGraph = workflowGraph;

      // Add extra node if downstream triggers exist
      if (triggers && triggers.length > 0) {
        triggers.forEach(t => {
          if (t.triggers && t.triggers.length > 0) {
            completeGraph.edges.push({
              src: t.jobName,
              dest: `~sd-${t.jobName}-triggers`
            });
            completeGraph.nodes.push({
              name: `~sd-${t.jobName}-triggers`,
              triggers: t.triggers,
              status: 'DOWNSTREAM_TRIGGER'
            });
          }
        });
      }
      if (completeGraph) {
        completeGraph.nodes = uniqBy(completeGraph.nodes || [], n => n.name);

        completeGraph.edges = (completeGraph.edges || []).filter(e => {
          const srcFound =
            !e.src || !!completeGraph.nodes.find(n => n.name === e.src);
          const destFound =
            !e.dest || !!completeGraph.nodes.find(n => n.name === e.dest);

          return srcFound && destFound;
        });
      }

      return completeGraph;
    }
  }),
  currentEventType: computed('activeTab', {
    get() {
      return this.activeTab === 'pulls' ? 'pr' : 'pipeline';
    }
  }),
  // Aggregates first page events and events via ModelReloaderMixin
  modelEvents: computed('model.events', {
    get() {
      let previousModelEvents = this.previousModelEvents || [];

      let currentModelEvents = this.getWithDefault(
        'model.events',
        []
      ).toArray();

      let newModelEvents = [];
      const newPipelineId = this.get('pipeline.id');

      // purge unmatched pipeline events
      if (
        previousModelEvents.some(e => e.get('pipelineId') !== newPipelineId)
      ) {
        newModelEvents = [...currentModelEvents];

        this.set('paginateEvents', []);
        this.set('previousModelEvents', newModelEvents);
        this.set('moreToShow', true);

        return newModelEvents;
      }

      previousModelEvents = previousModelEvents.filter(
        e => !currentModelEvents.find(c => c.id === e.id)
      );

      newModelEvents = currentModelEvents.concat(previousModelEvents);

      this.set('previousModelEvents', newModelEvents);

      return newModelEvents;
    }
  }),
  pipelineEvents: computed('modelEvents', 'paginateEvents.[]', {
    get() {
      this.shuttle.getLatestCommitEvent(this.get('pipeline.id')).then(event => {
        this.set('latestCommit', event);
      });

      const pipelineEvents = [].concat(this.modelEvents, this.paginateEvents);

      // filter events for no builds
      if (this.isFilteredEventsForNoBuilds) {
        const filteredEvents = pipelineEvents.filter(
          (event, idx) => event.status !== 'SKIPPED' || idx === 0
        );

        return filteredEvents;
      }

      return pipelineEvents;
    }
  }),
  prEvents: computed('model.events.@each.workflowGraph', 'prChainEnabled', {
    get() {
      const prEvents = this.get('model.events')
        .filter(e => e.prNum)
        .sortBy('createTime')
        .reverse();

      if (!this.prChainEnabled) {
        return prEvents.map(prEvent => {
          const prWorkflowGraph = prEvent.workflowGraph;

          const prNodes = prWorkflowGraph.nodes.filter(n =>
            n.name.startsWith('~pr')
          );
          const edgesToAdd = [];
          const nodesToAdd = [...prNodes];

          // 1 level deep
          prWorkflowGraph.edges.forEach(e => {
            prNodes.forEach(prNode => {
              if (prNode.name === e.src) {
                const endNode = prWorkflowGraph.nodes.findBy('name', e.dest);

                nodesToAdd.pushObject(endNode);
                edgesToAdd.pushObject(e);
              }
            });
          });

          prWorkflowGraph.edges.clear();
          prWorkflowGraph.edges.pushObjects(edgesToAdd);
          prWorkflowGraph.nodes.clear();
          prWorkflowGraph.nodes.pushObjects(nodesToAdd);

          return prEvent;
        });
      }

      return prEvents;
    }
  }),
  events: computed('pipelineEvents', 'prEvents', 'currentEventType', {
    get() {
      if (this.currentEventType === 'pr') {
        return this.prEvents;
      }

      return this.pipelineEvents;
    }
  }),
  pullRequestGroups: computed('model.jobs', {
    get() {
      const jobs = this.getWithDefault('model.jobs', []);

      let groups = {};

      return jobs
        .filter(j => j.get('isPR'))
        .sortBy('createTime')
        .reverse()
        .reduce((results, j) => {
          const k = j.get('group');

          if (groups[k] === undefined) {
            groups[k] = results.length;
            results[groups[k]] = [j];
          } else {
            results[groups[k]].push(j);
          }

          return results;
        }, []);
    }
  }),
  isRestricted: computed('pipeline.annotations', {
    get() {
      const annotations = this.getWithDefault('pipeline.annotations', {});

      return (annotations['screwdriver.cd/restrictPR'] || 'none') !== 'none';
    }
  }),
  /**
   * Selected Event's Id (integer) in a string format, i.e. '379281'
   * @param  {String} selected
   * @param  {String} mostRecent
   * @return {String}
   */
  selectedEvent: computed('selected', 'mostRecent', {
    get() {
      return this.selected || this.mostRecent;
    }
  }),

  selectedEventObj: computed('selectedEvent', {
    get() {
      const selected = this.selectedEvent;

      return this.events.find(e => get(e, 'id') === selected);
    }
  }),

  mostRecent: computed('events.@each.status', {
    get() {
      const list = this.events || [];
      const event = list.find(e => get(e, 'status') === 'RUNNING');

      if (!event) {
        return list.length ? get(list[0], 'id') : 0;
      }

      return get(event, 'id');
    }
  }),

  lastSuccessful: computed('events.@each.status', {
    get() {
      const list = this.events || [];
      const event = list.find(e => get(e, 'status') === 'SUCCESS');

      if (!event) {
        return 0;
      }

      return get(event, 'id');
    }
  }),

  updateEvents,
  async checkForMorePage({ scrollTop, scrollHeight, clientHeight }) {
    if (scrollTop + clientHeight > scrollHeight - 300) {
      await this.updateEvents(this.eventsPage + 1);
    }
  },

  createEvent,

  actions: {
    setDownstreamTrigger() {
      this.set('showDownstreamTriggers', !this.get('showDownstreamTriggers'));
    },
    setShowListView(showListView) {
      if (showListView) {
        this.transitionToRoute('pipeline.jobs.index');
      }
    },
    async updateEvents(page) {
      await this.updateEvents(page);
    },
    async onEventListScroll({ currentTarget }) {
      if (this.moreToShow && !this.isFetching) {
        await this.checkForMorePage(currentTarget);
      }
    },
    startMainBuild(parameters) {
      this.set('isShowingModal', true);

      const token = get(this, 'session.data.authenticated.token');
      const user = get(decoder(token), 'username');
      const pipelineId = this.get('pipeline.id');

      let eventPayload = {
        pipelineId,
        startFrom: '~commit',
        causeMessage: `Manually started by ${user}`
      };

      if (parameters) {
        eventPayload.meta = { parameters };
      }

      return this.createEvent(eventPayload, false);
    },
    startDetachedBuild,
    stopBuild,
    async stopEvent() {
      const event = get(this, 'selectedEventObj');
      const eventId = get(event, 'id');

      try {
        return await this.get('stop').stopBuilds(eventId);
      } catch (e) {
        this.set(
          'errorMessage',
          Array.isArray(e.errors) ? e.errors[0].detail : ''
        );
      }

      return null;
    },
    async stopPRBuilds(jobs) {
      const eventId = jobs.get('firstObject.builds.firstObject.eventId');

      try {
        await this.get('stop').stopBuilds(eventId);
        if (this.refreshListViewJobs) {
          await this.refreshListViewJobs();
        }
      } catch (e) {
        this.set(
          'errorMessage',
          Array.isArray(e.errors) ? e.errors[0].detail : ''
        );
      }
    },
    startPRBuild(prNum, jobs, parameters) {
      this.set('isShowingModal', true);
      const user = get(
        decoder(this.get('session.data.authenticated.token')),
        'username'
      );

      let eventPayload = {
        causeMessage: `Manually started by ${user}`,
        pipelineId: this.get('pipeline.id'),
        startFrom: '~pr',
        prNum
      };

      if (parameters) {
        eventPayload.meta = { parameters };
      }

      const newEvent = this.store.createRecord('event', eventPayload);

      return newEvent
        .save()
        .then(() =>
          newEvent.get('builds').then(async () => {
            if (this.refreshListViewJobs) {
              await this.refreshListViewJobs();
            }

            this.set('isShowingModal', false);

            // PR events are aggregated by each PR jobs when prChain is enabled.
            if (this.prChainEnabled) {
              const newEvents = this.prEvents.filter(
                e => e.get('prNum') !== prNum
              );

              newEvents.unshiftObject(newEvent);

              this.set('prEvents', newEvents);
            }
          })
        )
        .catch(e => {
          this.set('isShowingModal', false);
          this.set(
            'errorMessage',
            Array.isArray(e.errors) ? e.errors[0].detail : ''
          );
        })
        .finally(() => jobs.forEach(j => j.hasMany('builds').reload()));
    },

    async syncAdmins() {
      this.set('syncAdmins', 'init');

      try {
        const syncPath = '';

        await this.sync.syncRequests(this.get('pipeline.id'), syncPath);
        this.set('syncAdmins', 'success');

        await this.get('pipeline').reload();
      } catch (e) {
        this.set('syncAdmins', 'failure');
      }
    },
    setJobStatus(id, state, stateChangeMessage) {
      this.pipelineController.send(
        'setJobStatus',
        id,
        state,
        stateChangeMessage
      );
      this.reload();
    }
  },
  willDestroy() {
    // FIXME: Never called when route is no longer active
    this.stopReloading();
  },
  reloadTimeout: ENV.APP.EVENT_RELOAD_TIMER
});
