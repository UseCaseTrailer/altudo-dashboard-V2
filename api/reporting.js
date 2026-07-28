// GET /api/reporting
// One canonical reporting payload shared by the executive and team views.
const {
  getWorkspace,
  getWorkspaceCustomFields,
  getPortfolios,
  getPortfolioProjects,
  getProjectSections,
  getProjectTasks
} = require('../lib/asana');
const {
  customFieldValue,
  normaliseTask,
  healthFromStatus,
  buildReportingModel
} = require('../lib/reporting');

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, run));
  return results;
}

function accessIssue(scope, gid, name, error) {
  return {
    scope,
    gid,
    name,
    status: error.status || null,
    path: error.path || null,
    message: error.message
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({error: 'Method not allowed'});

  const fetchedAt = new Date().toISOString();
  const accessIssues = [];
  try {
    const [workspace, customFieldDefinitions, portfolioList] = await Promise.all([
      getWorkspace(),
      getWorkspaceCustomFields().catch(error => {
        accessIssues.push(accessIssue('workspace_custom_fields', null, null, error));
        return [];
      }),
      getPortfolios()
    ]);

    const projectCache = new Map();
    async function hydrateProject(project, portfolio) {
      if (!projectCache.has(project.gid)) {
        projectCache.set(project.gid, (async () => {
          try {
            const [sections, rawTasks] = await Promise.all([
              getProjectSections(project.gid),
              getProjectTasks(project.gid)
            ]);
            const tasks = [];
            rawTasks.forEach(task => {
              tasks.push(normaliseTask(task, project.gid));
              (task.subtasks || []).forEach(subtask => {
                tasks.push(normaliseTask(subtask, project.gid, task.gid));
              });
            });
            return {
              gid: project.gid,
              name: project.name,
              archived: Boolean(project.archived),
              createdAt: project.created_at || null,
              startAt: project.start_on || null,
              dueAt: project.due_at || project.due_on || null,
              owner: project.owner
                ? {gid: project.owner.gid, name: project.owner.name}
                : null,
              currentStatus: project.current_status
                ? {
                    color: project.current_status.color,
                    title: project.current_status.title,
                    text: project.current_status.text,
                    createdAt: project.current_status.created_at,
                    authorName: project.current_status.author?.name || null
                  }
                : null,
              health: healthFromStatus(project.current_status),
              customFields: (project.custom_fields || []).map(customFieldValue),
              sections,
              tasks
            };
          } catch (error) {
            accessIssues.push(accessIssue('project', project.gid, project.name, error));
            return {
              gid: project.gid,
              name: project.name,
              owner: project.owner
                ? {gid: project.owner.gid, name: project.owner.name}
                : null,
              currentStatus: project.current_status || null,
              health: healthFromStatus(project.current_status),
              customFields: (project.custom_fields || []).map(customFieldValue),
              sections: [],
              tasks: [],
              unavailable: true,
              unavailableReason: error.message
            };
          }
        })());
      }
      const hydrated = await projectCache.get(project.gid);
      return {...hydrated, portfolioGid: portfolio.gid, portfolioName: portfolio.name};
    }

    const portfolios = await mapWithConcurrency(portfolioList, 4, async portfolio => {
      try {
        const items = (await getPortfolioProjects(portfolio.gid))
          .filter(item => item.resource_type === 'project');
        const projects = await mapWithConcurrency(items, 4, item => hydrateProject(item, portfolio));
        return {
          gid: portfolio.gid,
          name: portfolio.name,
          color: portfolio.color || '#6366f1',
          owner: portfolio.owner
            ? {gid: portfolio.owner.gid, name: portfolio.owner.name}
            : null,
          projects
        };
      } catch (error) {
        accessIssues.push(accessIssue('portfolio', portfolio.gid, portfolio.name, error));
        return {
          gid: portfolio.gid,
          name: portfolio.name,
          color: portfolio.color || '#6366f1',
          owner: portfolio.owner || null,
          projects: [],
          unavailable: true,
          unavailableReason: error.message
        };
      }
    });

    const model = buildReportingModel({
      workspace,
      portfolios,
      customFieldDefinitions,
      fetchedAt
    });
    model.dataQuality.accessIssues = accessIssues;
    res.setHeader('Cache-Control', 's-maxage=60,stale-while-revalidate=300');
    return res.status(accessIssues.length ? 207 : 200).json({data: model});
  } catch (error) {
    const status = error.status === 401 || error.status === 403 ? 502 : 500;
    return res.status(status).json({
      error: error.message,
      accessIssue: {
        scope: 'workspace_or_portfolio_list',
        status: error.status || null,
        path: error.path || null
      },
      fetchedAt
    });
  }
}
