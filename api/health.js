export default async function handler(req, res) {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    asana_pat:       !!process.env.ASANA_PAT,
    openai_key:      !!process.env.OPENAI_API_KEY,
    openai_model:    process.env.OPENAI_MODEL || 'gpt-5.6',
    workspace:       process.env.ASANA_WORKSPACE_GID || '1115662927527527',
    version: '3.0.0'
  });
}
