// lib/asana.js — Asana REST API helper
const BASE = 'https://app.asana.com/api/1.0';
const WS   = process.env.ASANA_WORKSPACE_GID || '1115662927527527';

async function asanaGet(path, params={}) {
  const token = process.env.ASANA_PAT;
  if(!token) throw new Error('ASANA_PAT not set');
  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k,v]) => { if(v!=null) url.searchParams.set(k,v); });
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  if(!res.ok) throw new Error(`Asana ${res.status}: ${await res.text()}`);
  return (await res.json()).data;
}

async function asanaWrite(method, path, body) {
  const token = process.env.ASANA_PAT;
  if(!token) throw new Error('ASANA_PAT not set');
  const res = await fetch(`${BASE}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: body })
  });
  if(!res.ok) throw new Error(`Asana ${res.status}: ${await res.text()}`);
  return (await res.json()).data;
}

const PROJ_FIELDS = [
  'name,gid,color,resource_type,due_on,start_on,owner.name',
  'current_status.color,current_status.title,current_status.text',
  'num_tasks,num_incomplete_tasks,num_completed_tasks',
  'custom_fields.name,custom_fields.display_value'
].join(',');

module.exports = {
  getPortfolios: () => asanaGet('/portfolios', { workspace:WS, owner:'me', opt_fields:'name,gid,color,owner.name', limit:100 }),
  getPortfolioProjects: (gid) => asanaGet(`/portfolios/${gid}/items`, { opt_fields:PROJ_FIELDS, limit:100 }),
  getProjectTasks: (gid) => asanaGet('/tasks', { project:gid, opt_fields:'name,gid,completed,due_on,assignee.name', limit:100 }),
  updateTask: (gid, body) => asanaWrite('PUT', `/tasks/${gid}`, body),
  createTask: (body) => asanaWrite('POST', '/tasks', { workspace:WS, ...body }),
  addComment: (gid, text) => asanaWrite('POST', `/tasks/${gid}/stories`, { text }),
};
