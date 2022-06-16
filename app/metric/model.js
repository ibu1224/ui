import DS from 'ember-data';

export default DS.Model.extend({
  pipelineId: DS.attr('string'),
  pipeline: DS.belongsTo('pipeline'),
  createTime: DS.attr('date'),
  causeMessage: DS.attr('string'),
  sha: DS.attr('string'),
  queuedTime: DS.attr('number'),
  imagePullTime: DS.attr('number'),
  duration: DS.attr('number'),
  status: DS.attr('string', { defaultValue: 'UNKNOWN' }),
  builds: DS.attr(),
  commit: DS.attr(),
  jobId: DS.attr('number'),
  eventId: DS.attr('number'),
  steps: DS.attr()
});

// // post model
// export default Model.extend({
//   name: attr('string'),
//   comments: hasMany('comment'),
// });

// // comment model
// export default Model.extend({
//   post: belongsTo('post'),
//   content: attr('string')
// });

// Existing APIs:
// ```
// /post/

// /post/id
// {id: 'p1', name: xxx }

// /post/:id/comments
// [{id: 'c1', content: 'aaa'}, {id: 'c2', content: 'bbb'}]
// ```

// As you can see there's no relationship in the api, how can we achieve in the UI, if possible at all, thanks.
