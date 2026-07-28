// api/portfolios.js — GET /api/portfolios
const { getPortfolios, getPortfolioProjects, getProjectTasks } = require('../lib/asana');

function score(tasks) {
  const n = tasks.length || 1, today = new Date().toISOString().split('T')[0];
  const done = tasks.filter(t=>t.completed).length;
  const ov   = tasks.filter(t=>!t.completed&&t.due_on&&t.due_on<today).length;
  const ua   = tasks.filter(t=>!t.assignee).length;
  const cp   = Math.round(done/n*100);
  const oS   = Math.max(0,100-Math.round(ov/n*100)*3);
  const aS   = Math.max(0,100-Math.round(ua/n*100)*2);
  return { v:Math.round(cp*.3+oS*.35+aS*.2+(Math.max(0,100-Math.round(tasks.filter(t=>!t.completed&&!t.due_on).length/n*100)*1.5))*.15), done, ov, ua, N:n };
}

module.exports = async function handler(req, res) {
  if(req.method==='OPTIONS') return res.status(200).end();
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  try {
    const portfolios = await getPortfolios();
    const enriched = await Promise.all(portfolios.map(async port => {
      let projects = [];
      try {
        const items = (await getPortfolioProjects(port.gid)).filter(i=>i.resource_type==='project');
        projects = await Promise.all(items.map(async proj => {
          let tasks = [];
          try { tasks = await getProjectTasks(proj.gid); } catch(e) {}
          const norm = tasks.map(t=>({gid:t.gid,n:t.name,done:t.completed,due:t.due_on||null,who:t.assignee?.name||null}));
          return { gid:proj.gid, name:proj.name, due_on:proj.due_on||null, owner:proj.owner?.name||null,
            status:proj.current_status?{color:proj.current_status.color,title:proj.current_status.title,text:proj.current_status.text}:null,
            score:score(tasks), tasks:norm };
        }));
      } catch(e) {}
      return { gid:port.gid, name:port.name, color:port.color||'#6366f1', projects };
    }));
    res.setHeader('Cache-Control','s-maxage=60,stale-while-revalidate=300');
    return res.status(200).json({ data:enriched, fetchedAt:new Date().toISOString() });
  } catch(err) {
    return res.status(500).json({ error:err.message });
  }
}
