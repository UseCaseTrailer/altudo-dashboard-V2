const test = require('node:test');
const assert = require('node:assert/strict');
const {projectMetrics, buildReportingModel} = require('../lib/reporting');

function task(overrides = {}) {
  return {
    gid: overrides.gid || Math.random().toString(36),
    name: overrides.name || 'Task',
    parentTaskGid: null,
    resourceSubtype: 'default_task',
    createdAt: '2026-07-01T12:00:00.000Z',
    modifiedAt: '2026-07-01T12:00:00.000Z',
    startAt: '2026-07-02',
    dueAt: '2026-07-20',
    completed: false,
    completedAt: null,
    assignee: {gid: 'u1', name: 'Owner One'},
    section: {gid: 's1', name: 'Execution'},
    dependencies: [],
    dependents: [],
    tags: [],
    customFields: [],
    ...overrides
  };
}

function project(overrides = {}) {
  return {
    gid: overrides.gid || 'p1',
    name: overrides.name || 'Project One',
    portfolioName: 'Portfolio One',
    health: 'at_risk',
    currentStatus: {color: 'yellow', title: 'At risk'},
    customFields: [],
    tasks: [],
    ...overrides
  };
}

test('same-day completion is on time for a date-only due date', () => {
  const metrics = projectMetrics(project({
    tasks: [task({
      completed: true,
      completedAt: '2026-07-20T18:30:00.000Z'
    })]
  }), '2026-07-28T12:00:00.000Z');
  assert.equal(metrics.onTimeCompletion.trailing30.rate, 100);
});

test('blocked and overdue work drive traceable risk and action', () => {
  const metrics = projectMetrics(project({
    dueAt: '2026-07-25',
    tasks: [
      task({
        name: 'Launch review',
        dueAt: '2026-07-10',
        dependencies: [{gid: 'dep1', name: 'Legal approval', completed: false}]
      })
    ]
  }), '2026-07-28T12:00:00.000Z');
  assert.equal(metrics.counts.overdue, 1);
  assert.equal(metrics.counts.blocked, 1);
  assert.match(metrics.risk.driver, /blocked by incomplete dependencies/);
  assert.match(metrics.nextBestAction, /Launch review/);
});

test('model counts a project once when it belongs to multiple portfolios', () => {
  const shared = project({gid: 'shared', tasks: [task({gid: 't1'})]});
  const model = buildReportingModel({
    workspace: {gid: 'w1', name: 'Workspace'},
    portfolios: [
      {gid: 'a', name: 'A', projects: [shared]},
      {gid: 'b', name: 'B', projects: [{...shared, portfolioName: 'B'}]}
    ],
    customFieldDefinitions: [],
    fetchedAt: '2026-07-28T12:00:00.000Z'
  });
  assert.equal(model.aggregate.portfolioCount, 2);
  assert.equal(model.aggregate.projectCount, 1);
  assert.equal(model.aggregate.taskCount, 1);
});

test('duplicate custom-field labels remain separated by GID', () => {
  const model = buildReportingModel({
    workspace: {gid: 'w1', name: 'Workspace'},
    portfolios: [{
      gid: 'a',
      name: 'A',
      projects: [
        project({
          gid: 'p1',
          customFields: [{fieldGid: 'cf1', fieldName: 'Priority'}],
          tasks: []
        }),
        project({
          gid: 'p2',
          customFields: [{fieldGid: 'cf2', fieldName: 'Priority'}],
          tasks: []
        })
      ]
    }],
    customFieldDefinitions: [],
    fetchedAt: '2026-07-28T12:00:00.000Z'
  });
  assert.equal(model.dataQuality.duplicateCustomFields.length, 1);
  assert.deepEqual(model.dataQuality.duplicateCustomFields[0].fieldGids, ['cf1', 'cf2']);
});
