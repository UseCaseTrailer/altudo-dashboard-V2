// api/task-action.js — POST /api/task-action
const { updateTask, createTask, addComment } = require('../lib/asana');

module.exports = async function handler(req, res) {
  if(req.method==='OPTIONS') return res.status(200).end();
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const { action, taskGid, task_gid, projectGid, project_gid, ...params } = req.body || {};
  const taskId = taskGid || task_gid;
  const projectId = projectGid || project_gid;
  const allowed = ['COMPLETE_TASK','ADD_COMMENT','ASSIGN_TASK','UPDATE_DUE_DATE','RENAME_TASK','CREATE_TASK'];
  if(!allowed.includes(action)) return res.status(400).json({error:`Unknown action: ${action}`});
  try {
    let result;
    if(action!=='CREATE_TASK' && !taskId) return res.status(400).json({error:'task_gid is required'});
    if(action==='COMPLETE_TASK')  result = await updateTask(taskId, {completed:params.completed??true});
    if(action==='ADD_COMMENT')    result = await addComment(taskId, params.comment);
    if(action==='ASSIGN_TASK')    result = await updateTask(taskId, {assignee:params.assignee});
    if(action==='UPDATE_DUE_DATE')result = await updateTask(taskId, {due_on:params.due_on});
    if(action==='RENAME_TASK')    result = await updateTask(taskId, {name:params.new_name});
    if(action==='CREATE_TASK')    result = await createTask({name:params.name,...(projectId&&{projects:[projectId]}),...(params.assignee&&{assignee:params.assignee}),...(params.due_on&&{due_on:params.due_on}),...(params.notes&&{notes:params.notes})});
    return res.status(200).json({ok:true,data:result});
  } catch(err) { return res.status(500).json({error:err.message}); }
}
