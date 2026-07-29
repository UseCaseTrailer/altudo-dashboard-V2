// Asana REST API helper. All collection reads are paginated and all field
// identity is preserved by GID so reporting never merges look-alike fields.
const BASE = 'https://app.asana.com/api/1.0';
const WS = process.env.ASANA_WORKSPACE_GID || '1115662927527527';
const PAGE_SIZE = 100;

class AsanaAccessError extends Error {
  constructor(status, path, detail) {
    super(`Asana ${status} for ${path}: ${detail}`);
    this.name = 'AsanaAccessError';
    this.status = status;
    this.path = path;
  }
}

async function asanaRequest(method, path, body, params = {}) {
  const token = process.env.ASANA_PAT;
  if (!token) throw new Error('ASANA_PAT not set');
  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) url.searchParams.set(key, value);
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body ? {'Content-Type': 'application/json'} : {})
      },
      ...(body ? {body: JSON.stringify({data: body})} : {})
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) return payload;
    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < 2) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfter)
        ? Math.min(5000, retryAfter * 1000)
        : 500 * (2 ** attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    const detail = payload?.errors?.map(error => error.message).join('; ')
      || payload?.error
      || response.statusText;
    throw new AsanaAccessError(response.status, path, detail);
  }
  throw new AsanaAccessError(500, path, 'Retry limit reached');
}

async function asanaGet(path, params = {}) {
  return (await asanaRequest('GET', path, null, params)).data;
}

async function asanaGetAll(path, params = {}) {
  const data = [];
  let offset;
  do {
    const payload = await asanaRequest('GET', path, null, {
      ...params,
      limit: PAGE_SIZE,
      ...(offset ? {offset} : {})
    });
    data.push(...(payload.data || []));
    offset = payload.next_page?.offset || null;
  } while (offset);
  return data;
}

async function asanaWrite(method, path, body) {
  return (await asanaRequest(method, path, body)).data;
}

const PROJECT_FIELDS = [
  'name', 'gid', 'color', 'resource_type', 'archived', 'created_at',
  'due_on', 'due_at', 'start_on', 'owner.gid', 'owner.name',
  'current_status.color', 'current_status.title', 'current_status.text',
  'current_status.created_at', 'current_status.author.name',
  'custom_fields.gid', 'custom_fields.name', 'custom_fields.resource_subtype',
  'custom_fields.type', 'custom_fields.display_value',
  'custom_fields.number_value', 'custom_fields.text_value',
  'custom_fields.date_value', 'custom_fields.enum_value.gid',
  'custom_fields.enum_value.name', 'custom_fields.multi_enum_values.gid',
  'custom_fields.multi_enum_values.name'
].join(',');

const TASK_FIELDS = [
  'gid', 'name', 'resource_subtype', 'created_at', 'modified_at',
  'completed', 'completed_at', 'start_on', 'start_at', 'due_on', 'due_at',
  'assignee.gid', 'assignee.name', 'num_subtasks',
  'memberships.project.gid', 'memberships.section.gid',
  'memberships.section.name', 'tags.gid', 'tags.name',
  'dependencies.gid', 'dependencies.name', 'dependencies.completed',
  'dependencies.due_on', 'dependents.gid', 'dependents.name',
  'custom_fields.gid', 'custom_fields.name', 'custom_fields.resource_subtype',
  'custom_fields.type', 'custom_fields.display_value',
  'custom_fields.number_value', 'custom_fields.text_value',
  'custom_fields.date_value', 'custom_fields.enum_value.gid',
  'custom_fields.enum_value.name', 'custom_fields.multi_enum_values.gid',
  'custom_fields.multi_enum_values.name'
].join(',');

const CUSTOM_FIELD_FIELDS = [
  'gid', 'name', 'resource_subtype', 'type', 'description', 'precision',
  'currency_code', 'enum_options.gid', 'enum_options.name',
  'enum_options.enabled', 'enum_options.color'
].join(',');

async function getPortfolios() {
  const configured = (process.env.ASANA_PORTFOLIO_GIDS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const department = (process.env.ASANA_DEPARTMENT_PORTFOLIO_GIDS || '1213303616045074')
    .map(value => value.trim())
    .filter(Boolean);
  const scoped = [...new Set([...configured, ...department])];
  if (scoped.length) {
    return Promise.all(scoped.map(gid => asanaGet(`/portfolios/${gid}`, {
      opt_fields: 'name,gid,color,owner.gid,owner.name'
    })));
  }
  return asanaGetAll('/portfolios', {
    workspace: WS,
    owner: process.env.ASANA_PORTFOLIO_OWNER_GID || 'me',
    opt_fields: 'name,gid,color,owner.gid,owner.name'
  });
}

async function getProjectTasks(gid) {
  const tasks = await asanaGetAll('/tasks', {
    project: gid,
    opt_fields: TASK_FIELDS
  });
  const withSubtasks = await mapWithConcurrency(tasks, 6, async task => {
    if (!task.num_subtasks) return {...task, subtasks: []};
    const subtasks = await asanaGetAll(`/tasks/${task.gid}/subtasks`, {
      opt_fields: TASK_FIELDS
    });
    return {...task, subtasks};
  });
  return withSubtasks;
}

async function mapWithConcurrency(items, limit, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, run));
  return output;
}

module.exports = {
  WS,
  AsanaAccessError,
  getWorkspace: () => asanaGet(`/workspaces/${WS}`, {opt_fields: 'gid,name'}),
  getWorkspaceCustomFields: () => asanaGetAll(`/workspaces/${WS}/custom_fields`, {
    opt_fields: CUSTOM_FIELD_FIELDS
  }),
  getPortfolios,
  getPortfolioProjects: gid => asanaGetAll(`/portfolios/${gid}/items`, {
    opt_fields: PROJECT_FIELDS
  }),
  getProjectSections: gid => asanaGetAll(`/projects/${gid}/sections`, {
    opt_fields: 'gid,name,created_at'
  }),
  getProjectTasks,
  updateTask: (gid, body) => asanaWrite('PUT', `/tasks/${gid}`, body),
  createTask: body => asanaWrite('POST', '/tasks', {workspace: WS, ...body}),
  addComment: (gid, text) => asanaWrite('POST', `/tasks/${gid}/stories`, {text})
};
