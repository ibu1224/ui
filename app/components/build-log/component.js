import classic from 'ember-classic-decorator';
import { tagName } from '@ember-decorators/component';
import { observes } from '@ember-decorators/object';
import { inject as service } from '@ember/service';
import { set, action, computed } from '@ember/object';
import { guidFor } from '@ember/object/internals';
import { Promise } from 'rsvp';
import { scheduleOnce, later } from '@ember/runloop';
import Component from '@ember/component';
import ENV from 'screwdriver-ui/config/environment';

const timeTypes = ['datetime', 'datetimeUTC', 'elapsedBuild', 'elapsedStep'];

@classic
@tagName('')
export default class BuildLog extends Component {
  @service('build-logs')
  logService;

  @service
  store;

  fullScreen = false;

  lineWrap = true;

  autoscroll = true;

  isFetching = false;

  logFetchError = false;

  isDownloading = false;

  inProgress = false;

  justFinished = false;

  timeFormat = 'datetime';

  lastScrollTop = 0;

  lastScrollHeight = 0;

  // eslint-disable-next-line ember/no-observers
  @observes('totalLine')
  inProgressObserver() {
    const inProgress = this.totalLine === undefined;

    // step just finished
    if (this.inProgress && !inProgress) {
      this.set('justFinished', true);
    }

    this.set('inProgress', inProgress);
  }

  @computed('inProgress', 'justFinished')
  get sortOrder() {
    return this.inProgress || this.justFinished ? 'ascending' : 'descending';
  }

  getPageSize(fetchMax = false) {
    const { totalLine, inProgress, justFinished } = this;

    let itemSize =
      this.logService.getCache(this.buildId, this.stepName, 'nextLine') ||
      totalLine;

    if (justFinished) {
      itemSize = totalLine - itemSize + 1;
    }

    // for running step, fetch regular page size
    if (inProgress) {
      return ENV.APP.DEFAULT_LOG_PAGE_SIZE;
    }

    // For lazily loading old logs, if the number of log lines is too few on a page,
    // instead of having another fetch following right after the first render and user scrolls up,
    // we fetch an extra page of logs to have better UX
    // Or for the case with max fetch, calculate the remaining pages to fetch
    return fetchMax
      ? Math.ceil(itemSize / ENV.APP.MAX_LOG_LINES)
      : +(
          itemSize < ENV.APP.MAX_LOG_LINES ||
          itemSize % ENV.APP.MAX_LOG_LINES < 100
        ) + 1;
  }

  @computed(
    'buildId',
    'buildStartTime',
    'buildStatus',
    'isFetching',
    'justFinished',
    'stepEndTime',
    'stepName',
    'stepStartTime',
    'logFetchError'
  )
  get logs() {
    const { buildId, stepName, isFetching, buildStats, buildStatus } = this;
    const logs = this.logService.getCache(buildId, stepName, 'logs');
    const started = !!this.stepStartTime;

    if (!stepName) {
      return [{ m: 'Click a step to see logs' }];
    }

    // Generate init step logs using build stats
    if (stepName === 'sd-setup-init') {
      const initLogs = [];

      initLogs.push({
        t: new Date(this.stepStartTime).getTime(),
        m: 'Build created.',
        n: 0
      });

      const currentBuild = this.store.peekRecord('build', buildId) || {};
      const parameters = currentBuild.meta?.parameters || {};

      if (Object.keys(parameters).length > 0) {
        initLogs.push({
          t: new Date(this.stepEndTime).getTime(),
          m: `Build parameters: ${JSON.stringify(parameters, null, 2)}`,
          n: 1
        });
      }

      if (buildStatus === 'FROZEN') {
        initLogs.push({
          t: new Date(this.stepEndTime).getTime(),
          m: 'Build frozen and removed from the queue.',
          n: 1
        });

        return initLogs;
      }

      if (buildStats.queueEnterTime) {
        initLogs.push({
          t: new Date(buildStats.queueEnterTime).getTime(),
          m: 'Build enqueued.',
          n: 1
        });

        if (buildStatus === 'COLLAPSED') {
          initLogs.push({
            t: new Date(this.stepEndTime).getTime(),
            m: 'Build collapsed and removed from the queue.',
            n: 1
          });

          return initLogs;
        }

        if (buildStats.blockedStartTime) {
          initLogs.push({
            t: new Date(buildStats.blockedStartTime).getTime(),
            m: 'Build blocked, putting back into queue.',
            n: 1
          });
        }

        if (buildStats.hostname && buildStats.imagePullStartTime) {
          initLogs.push({
            t: new Date(buildStats.imagePullStartTime).getTime(),
            m: `Build scheduled on ${buildStats.hostname}. Starting image pull.`,
            n: 2
          });
        }

        if (this.stepEndTime) {
          let msg = 'Image pull completed. Build init completed.';

          // If build init succeeded and build starts, there should be buildStartTime
          if (!this.buildStartTime) {
            msg = 'Build init failed.';
          }

          initLogs.push({
            t: new Date(this.stepEndTime).getTime(),
            m: msg,
            n: 3
          });

          set(this, 'totalLine', 4);
        }

        return initLogs;
      }

      // If there is no build stat, update totalLine when step ends
      if (this.stepEndTime) {
        initLogs.push({
          t: new Date(this.stepEndTime).getTime(),
          m: 'Build init done.',
          n: 1
        });

        set(this, 'totalLine', 2);
      }

      return initLogs;
    }

    if (!logs) {
      if (!isFetching && started && !this.logFetchError) {
        this.getLogs();
      }

      return [{ m: `Loading logs for step ${stepName}...` }];
    }

    if (this.justFinished) {
      // there were logs in the cache, fetch the last batch of logs
      this.getLogs(true);
    }

    scheduleOnce('afterRender', this, 'scrollDown');

    return logs;
  }

  /**
   * Determines if log loading should occur
   * - step must have a defined start time (it is, or has executed)
   * - the step must have logs left to load
   * @property {Boolean} shouldLoad
   */
  @computed('isFetching', 'buildId', 'stepName')
  get shouldLoad() {
    const name = this.stepName;

    if (!name) {
      return false;
    }

    return !this.logService.getCache(this.buildId, name, 'done');
  }

  init() {
    super.init(...arguments);

    this.id = guidFor(this);

    const timeFormat = localStorage.getItem('screwdriver.logs.timeFormat');

    if (timeFormat && timeTypes.includes(timeFormat)) {
      set(this, 'timeFormat', timeFormat);
    }

    this.logService.resetCache();
    set(this, 'lastStepId', `${this.buildId}/${this.stepName}`);
  }

  // Start loading logs immediately upon inserting the element if a step is selected
  didInsertElement() {
    super.didInsertElement(...arguments);

    if (this.stepName) {
      this.getLogs();
    }
  }

  didReceiveAttrs() {
    super.didReceiveAttrs(...arguments);
    this.set('inProgress', this.totalLine === undefined);
  }

  didUpdateAttrs() {
    super.didUpdateAttrs(...arguments);
    const newStepId = `${this.buildId}/${this.stepName}`;

    if (newStepId !== this.lastStepId) {
      this.setProperties({
        autoscroll: true,
        lastStepId: newStepId,
        lastScrollTop: 0,
        lastScrollHeight: 0,
        isDownloading: false,
        justFinished: false,
        inProgress: this.totalLine === undefined
      });
    }
  }

  /**
   * Remove scroll listener when component is destroyed
   * @method willDestroyElement
   */
  willDestroyElement() {
    super.willDestroyElement(...arguments);
    this.logService.resetCache();
  }

  /**
   * Scroll to the top of the page
   * @method scrollTop
   */
  scrollTop() {
    document.querySelectorAll(`#${this.id} .wrap`)[0].scrollTop = 0;
  }

  /**
   * Scroll to the bottom of the page
   * @method scrollDown
   */
  scrollDown() {
    if (this.autoscroll) {
      const bottom = document.querySelector(`#${this.id} .bottom`).offsetTop;

      document.querySelector(`#${this.id} .wrap`).scrollTop = bottom;
      set(this, 'lastScrollTop', bottom);
    }
  }

  /**
   * Scroll back to the last anchor point
   * @method scrollStill
   */
  scrollStill() {
    const container = document.querySelector(`#${this.id} .wrap`);

    set(
      this,
      'lastScrollTop',
      (container.scrollTop =
        this.lastScrollTop + (container.scrollHeight - this.lastScrollHeight))
    );
  }

  /**
   * Fetch logs from log service
   * @method getLogs
   *
   * @param {boolean} fetchMax
   */
  getLogs(fetchMax = false) {
    if (
      !this.isDestroyed &&
      !this.isDestroying &&
      !this.isFetching &&
      this.shouldLoad
    ) {
      const { buildId, stepName, totalLine } = this;
      const started = !!this.stepStartTime;

      set(this, 'isFetching', true);

      return this.logService
        .fetchLogs({
          buildId,
          stepName,
          logNumber:
            this.logService.getCache(buildId, stepName, 'nextLine') ||
            (totalLine || 1) - 1,
          pageSize: this.getPageSize(fetchMax),
          sortOrder: this.sortOrder,
          started
        })
        .then(({ done, error }) => {
          // prevent updating logs when component is being destroyed
          if (!this.isDestroyed && !this.isDestroying) {
            const container = document.querySelector(`#${this.id} .wrap`);
            const { inProgress, justFinished } = this;

            set(this, 'isFetching', false);
            set(this, 'lastScrollTop', container.scrollTop);
            set(this, 'lastScrollHeight', container.scrollHeight);
            set(this, 'logFetchError', error);

            let cb = 'scrollTop';

            if (!fetchMax) {
              cb = inProgress ? 'scrollDown' : 'scrollStill';
            }

            if (justFinished) {
              cb = 'scrollDown';
            }

            scheduleOnce('afterRender', this, cb);

            if ((justFinished || inProgress) && !done) {
              later(this, 'getLogs', justFinished, ENV.APP.LOG_RELOAD_TIMER);
            }
          }
        });
    }

    return Promise.resolve();
  }

  @action
  scrollToTop() {
    set(this, 'autoscroll', false);

    if (!this.inProgress) {
      this.getLogs(true);
    }

    this.scrollTop();
  }

  @action
  scrollToBottom() {
    set(this, 'autoscroll', true);
    this.scrollDown();
  }

  @action
  download() {
    const { buildId, stepName } = this;
    const downloadLink = `${ENV.APP.SDAPI_HOSTNAME}/${ENV.APP.SDAPI_NAMESPACE}/builds/${buildId}/steps/${stepName}/logs?type=download`;

    window.open(downloadLink, '_blank');
  }

  @action
  logScroll() {
    const container = document.querySelector(`#${this.id} .wrap`);

    if (
      !this.inProgress &&
      !this.isFetching &&
      !this.logService.getCache(this.buildId, this.stepName, 'done') &&
      container.scrollTop < (container.scrollHeight - this.lastScrollHeight) / 2
    ) {
      this.getLogs();

      return;
    }

    // autoscroll when the bottom of the logs is roughly in view
    set(
      this,
      'autoscroll',
      document.querySelector(`#${this.id} .bottom`).getBoundingClientRect()
        .top < 1500
    );
  }

  @action
  toggleTimeDisplay() {
    let index = timeTypes.indexOf(this.timeFormat);

    index = index + 1 >= timeTypes.length ? 0 : index + 1;
    localStorage.setItem('screwdriver.logs.timeFormat', timeTypes[index]);
    set(this, 'timeFormat', timeTypes[index]);
  }

  @action
  toggleZoom() {
    this.toggleProperty('fullScreen');
  }

  @action
  toggleLineWrap() {
    this.toggleProperty('lineWrap');
  }
}
