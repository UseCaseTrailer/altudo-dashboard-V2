const DAY_MS = 86400000;

function isoDay(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function daysBetween(from, to) {
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(0, (end - start) / DAY_MS);
}

function dueDeadline(value) {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T23:59:59.999Z`)
    : new Date(value);
}

function average(values) {
  const valid = values.filter(value => Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function round(value, precision = 1) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function customFieldValue(field) {
  const options = field.multi_enum_values?.map(option => ({
    optionGid: option.gid,
    label: option.name
  })) || [];
  const enumValue = field.enum_value
    ? {optionGid: field.enum_value.gid, label: field.enum_value.name}
    : null;
  return {
    fieldGid: field.gid,
    fieldName: field.name,
    type: field.resource_subtype || field.type,
    displayValue: field.display_value ?? null,
    numberValue: field.number_value ?? null,
    textValue: field.text_value ?? null,
    dateValue: field.date_value ?? null,
    enumValue,
    multiEnumValues: options
  };
}

function normaliseTask(task, projectGid, parentTaskGid = null) {
  const membership = (task.memberships || []).find(item => item.project?.gid === projectGid)
    || task.memberships?.[0];
  return {
    gid: task.gid,
    name: task.name,
    resourceSubtype: task.resource_subtype || 'default_task',
    parentTaskGid,
    createdAt: task.created_at || null,
    modifiedAt: task.modified_at || null,
    startAt: task.start_at || task.start_on || null,
    dueAt: task.due_at || task.due_on || null,
    completed: Boolean(task.completed),
    completedAt: task.completed_at || null,
    assignee: task.assignee ? {gid: task.assignee.gid, name: task.assignee.name} : null,
    section: membership?.section
      ? {gid: membership.section.gid, name: membership.section.name}
      : null,
    dependencies: (task.dependencies || []).map(dependency => ({
      gid: dependency.gid,
      name: dependency.name,
      completed: Boolean(dependency.completed),
      dueAt: dependency.due_on || null
    })),
    dependents: (task.dependents || []).map(dependent => ({
      gid: dependent.gid,
      name: dependent.name
    })),
    tags: (task.tags || []).map(tag => ({gid: tag.gid, name: tag.name})),
    customFields: (task.custom_fields || []).map(customFieldValue)
  };
}

function healthFromStatus(status) {
  const color = String(status?.color || '').toLowerCase();
  if (color.includes('green') || color === 'complete') return 'on_track';
  if (color.includes('yellow') || color.includes('orange')) return 'at_risk';
  if (color.includes('red')) return 'off_track';
  return 'unreported';
}

function throughput(tasks, now, weeks = 12) {
  const end = new Date(now);
  const buckets = [];
  for (let index = weeks - 1; index >= 0; index -= 1) {
    const bucketEnd = new Date(end.getTime() - index * 7 * DAY_MS);
    const bucketStart = new Date(bucketEnd.getTime() - 7 * DAY_MS);
    buckets.push({
      start: bucketStart.toISOString().slice(0, 10),
      end: bucketEnd.toISOString().slice(0, 10),
      completed: 0,
      added: 0
    });
  }
  tasks.forEach(task => {
    const completedAt = task.completedAt ? new Date(task.completedAt) : null;
    const createdAt = task.createdAt ? new Date(task.createdAt) : null;
    buckets.forEach(bucket => {
      const start = new Date(bucket.start);
      const endAt = new Date(`${bucket.end}T23:59:59.999Z`);
      if (completedAt && completedAt >= start && completedAt <= endAt) bucket.completed += 1;
      if (createdAt && createdAt >= start && createdAt <= endAt) bucket.added += 1;
    });
  });
  return buckets;
}

function onTimeRate(tasks, now, trailingDays) {
  const since = new Date(new Date(now).getTime() - trailingDays * DAY_MS);
  const eligible = tasks.filter(task => {
    if (!task.completedAt || !task.dueAt) return false;
    return new Date(task.completedAt) >= since;
  });
  const onTime = eligible.filter(task => new Date(task.completedAt) <= dueDeadline(task.dueAt));
  return {
    rate: eligible.length ? round(onTime.length / eligible.length * 100) : null,
    onTime: onTime.length,
    eligible: eligible.length
  };
}

function projectMetrics(project, now = new Date().toISOString()) {
  const tasks = project.tasks || [];
  const topLevel = tasks.filter(task => !task.parentTaskGid);
  const open = topLevel.filter(task => !task.completed);
  const complete = topLevel.filter(task => task.completed);
  const overdue = open.filter(task => task.dueAt && dueDeadline(task.dueAt) < new Date(now));
  const blocked = open.filter(task => task.dependencies.some(dependency => !dependency.completed));
  const milestones = topLevel.filter(task => task.resourceSubtype === 'milestone');
  const completedMilestones = milestones.filter(task => task.completedAt && task.dueAt);
  const velocity = throughput(topLevel, now);
  const trailingFour = velocity.slice(-4).reduce((sum, bucket) => sum + bucket.completed, 0);
  const weeklyVelocity = trailingFour / 4;
  const forecastWeeks = open.length && weeklyVelocity > 0 ? open.length / weeklyVelocity : null;
  const forecastDate = forecastWeeks !== null
    ? new Date(new Date(now).getTime() + forecastWeeks * 7 * DAY_MS).toISOString().slice(0, 10)
    : null;
  const plannedDate = isoDay(project.dueAt);
  const forecastSlipDays = forecastDate && plannedDate
    ? Math.max(0, daysBetween(plannedDate, forecastDate))
    : 0;
  const overdueRatio = open.length ? overdue.length / open.length : 0;
  const blockedRatio = open.length ? blocked.length / open.length : 0;
  const riskScore = Math.min(100, round(
    overdueRatio * 50 + blockedRatio * 30 + Math.min(1, forecastSlipDays / 30) * 20,
    0
  ));

  const workload = {};
  open.forEach(task => {
    const key = task.assignee?.gid || 'unassigned';
    if (!workload[key]) {
      workload[key] = {
        assigneeGid: task.assignee?.gid || null,
        assigneeName: task.assignee?.name || 'Unassigned',
        openTasks: 0,
        overdueTasks: 0,
        blockedTasks: 0
      };
    }
    workload[key].openTasks += 1;
    if (overdue.includes(task)) workload[key].overdueTasks += 1;
    if (blocked.includes(task)) workload[key].blockedTasks += 1;
  });

  const stages = {};
  open.forEach(task => {
    const key = task.section?.gid || 'no_section';
    if (!stages[key]) {
      stages[key] = {
        sectionGid: task.section?.gid || null,
        sectionName: task.section?.name || 'No section',
        openTasks: 0,
        averageAgeDays: null,
        _ages: []
      };
    }
    stages[key].openTasks += 1;
    const age = task.createdAt ? daysBetween(task.createdAt, now) : null;
    if (age !== null) stages[key]._ages.push(age);
  });

  const overdueAging = {'1_7': 0, '8_30': 0, '30_plus': 0};
  overdue.forEach(task => {
    const age = Math.floor(daysBetween(task.dueAt, now));
    if (age <= 7) overdueAging['1_7'] += 1;
    else if (age <= 30) overdueAging['8_30'] += 1;
    else overdueAging['30_plus'] += 1;
  });

  const leadTimes = complete.map(task => daysBetween(task.createdAt, task.completedAt));
  const cycleTimes = complete.map(task => daysBetween(task.startAt, task.completedAt));
  const milestoneOnTime = completedMilestones.filter(
    task => new Date(task.completedAt) <= dueDeadline(task.dueAt)
  ).length;
  const confidence = trailingFour >= 8 ? 'medium' : trailingFour >= 3 ? 'low' : 'insufficient';
  const driver = blocked.length
    ? `${blocked.length} task${blocked.length === 1 ? '' : 's'} blocked by incomplete dependencies`
    : overdue.length
      ? `${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}`
      : forecastSlipDays
        ? `current four-week velocity projects a ${Math.ceil(forecastSlipDays)}-day slip`
        : 'no material schedule risk detected from the available snapshot';

  let nextBestAction = 'Maintain the current plan and review status at the next reporting cadence.';
  if (blocked.length) {
    const task = blocked.sort((a, b) => (a.dueAt || '9999').localeCompare(b.dueAt || '9999'))[0];
    nextBestAction = `Resolve the dependency blocking “${task.name}” and confirm an owner for the unblock action.`;
  } else if (overdue.length) {
    const task = overdue.sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))[0];
    nextBestAction = `Triage “${task.name}” with ${task.assignee?.name || 'the project owner'}: complete, re-date, reassign, or descope it.`;
  } else if (forecastSlipDays) {
    nextBestAction = `Protect the planned date by reducing remaining scope or increasing weekly throughput above ${round(weeklyVelocity)} tasks.`;
  }

  return {
    counts: {
      total: topLevel.length,
      complete: complete.length,
      open: open.length,
      overdue: overdue.length,
      blocked: blocked.length,
      unassigned: open.filter(task => !task.assignee).length,
      noDueDate: open.filter(task => !task.dueAt).length
    },
    completionRate: topLevel.length ? round(complete.length / topLevel.length * 100) : null,
    onTimeCompletion: {
      trailing30: onTimeRate(topLevel, now, 30),
      trailing60: onTimeRate(topLevel, now, 60),
      trailing90: onTimeRate(topLevel, now, 90)
    },
    throughput: velocity,
    weeklyVelocity: round(weeklyVelocity),
    averageLeadTimeDays: round(average(leadTimes)),
    averageCycleTimeDays: round(average(cycleTimes)),
    overdueAging,
    milestoneAdherence: {
      rate: completedMilestones.length
        ? round(milestoneOnTime / completedMilestones.length * 100)
        : null,
      onTime: milestoneOnTime,
      eligible: completedMilestones.length
    },
    workload: Object.values(workload).sort((a, b) => b.openTasks - a.openTasks),
    bottlenecks: Object.values(stages).map(stage => ({
      sectionGid: stage.sectionGid,
      sectionName: stage.sectionName,
      openTasks: stage.openTasks,
      averageAgeDays: round(average(stage._ages))
    })).sort((a, b) => b.openTasks - a.openTasks),
    blockedTasks: blocked,
    overdueTasks: overdue.sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt))),
    forecast: {
      plannedDate,
      forecastDate,
      forecastSlipDays: round(forecastSlipDays, 0),
      confidence,
      basis: `Current remaining scope and ${round(weeklyVelocity)} completed tasks/week over the last 4 weeks`
    },
    risk: {score: riskScore, driver},
    nextBestAction
  };
}

function duplicateFieldWarnings(projects) {
  const byName = new Map();
  projects.forEach(project => {
    [...(project.customFields || []), ...project.tasks.flatMap(task => task.customFields || [])]
      .forEach(field => {
        const name = String(field.fieldName || '').trim().toLowerCase();
        if (!name) return;
        if (!byName.has(name)) byName.set(name, new Map());
        const entry = byName.get(name);
        if (!entry.has(field.fieldGid)) entry.set(field.fieldGid, new Set());
        entry.get(field.fieldGid).add(project.gid);
      });
  });
  return [...byName.entries()]
    .filter(([, gids]) => gids.size > 1)
    .map(([name, gids]) => ({
      fieldName: name,
      fieldGids: [...gids.keys()],
      message: `“${name}” exists under ${gids.size} GIDs and was not merged across projects.`
    }));
}

function buildReportingModel({workspace, portfolios, customFieldDefinitions, fetchedAt}) {
  const projectMap = new Map();
  portfolios.flatMap(portfolio => portfolio.projects).forEach(project => {
    if (!projectMap.has(project.gid)) projectMap.set(project.gid, project);
  });
  const projects = [...projectMap.values()];
  projects.forEach(project => {
    project.metrics = projectMetrics(project, fetchedAt);
  });
  const healthCounts = {on_track: 0, at_risk: 0, off_track: 0, unreported: 0};
  projects.forEach(project => {
    healthCounts[project.health] += 1;
  });
  const allTasks = projects.flatMap(project => project.tasks.filter(task => !task.parentTaskGid));
  const aggregate = {
    portfolioCount: portfolios.length,
    projectCount: projects.length,
    taskCount: allTasks.length,
    healthDistribution: healthCounts,
    overdueTasks: allTasks.filter(task => !task.completed && task.dueAt && dueDeadline(task.dueAt) < new Date(fetchedAt)).length,
    blockedTasks: allTasks.filter(task => !task.completed && task.dependencies.some(dep => !dep.completed)).length,
    unassignedTasks: allTasks.filter(task => !task.completed && !task.assignee).length,
    throughput: throughput(allTasks, fetchedAt),
    riskRanking: projects
      .map(project => ({
        projectGid: project.gid,
        projectName: project.name,
        portfolioName: project.portfolioName,
        owner: project.owner,
        declaredHealth: project.health,
        riskScore: project.metrics.risk.score,
        driver: project.metrics.risk.driver,
        plannedDate: project.metrics.forecast.plannedDate,
        forecastDate: project.metrics.forecast.forecastDate,
        forecastConfidence: project.metrics.forecast.confidence,
        nextBestAction: project.metrics.nextBestAction
      }))
      .sort((a, b) => b.riskScore - a.riskScore)
  };

  const missing = {
    projectStatus: projects.filter(project => project.health === 'unreported').length,
    taskDueDate: allTasks.filter(task => !task.completed && !task.dueAt).length,
    taskAssignee: allTasks.filter(task => !task.completed && !task.assignee).length,
    taskStartDate: allTasks.filter(task => task.completed && !task.startAt).length
  };

  return {
    metadata: {
      source: 'Asana',
      workspace,
      fetchedAt,
      portfolioScope: process.env.ASANA_PORTFOLIO_GIDS || process.env.ASANA_DEPARTMENT_PORTFOLIO_GIDS
        ? 'Configured portfolio and department portfolio GIDs'
        : `Portfolios owned by ${process.env.ASANA_PORTFOLIO_OWNER_GID || 'the authenticated user'}`,
      forecastDisclaimer: 'Forecasts are directional, not commitments, and use current scope plus trailing four-week throughput.'
    },
    aggregate,
    portfolios,
    customFieldDefinitions,
    dataQuality: {
      missing,
      duplicateCustomFields: duplicateFieldWarnings(projects),
      unavailableMetrics: [
        {
          metric: 'Historical portfolio-health trend and status-change root cause',
          reason: 'Asana current-status reads do not provide a complete status history. Persist scheduled snapshots or ingest status stories.'
        },
        {
          metric: 'Baseline burndown, planned-vs-actual scope, and scope creep',
          reason: 'No durable baseline snapshot is configured. Store task snapshots on a schedule before calculating these metrics.'
        },
        {
          metric: 'Stage-to-stage cycle time',
          reason: 'Current section membership is available, but historical section-entry timestamps are not.'
        },
        {
          metric: 'Capacity utilization percentage',
          reason: 'Task counts are shown as workload. Reliable utilization requires capacity hours and estimated-effort fields with consistent GIDs.'
        }
      ]
    }
  };
}

module.exports = {
  customFieldValue,
  normaliseTask,
  healthFromStatus,
  projectMetrics,
  buildReportingModel
};
