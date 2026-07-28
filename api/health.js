module.exports = async function handler(req, res) {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    asana_pat:       !!process.env.ASANA_PAT,
    anthropic_key:   !!process.env.ANTHROPIC_API_KEY,
    openai_key:      !!process.env.OPENAI_API_KEY,
    workspace:       process.env.ASANA_WORKSPACE_GID || '1115662927527527',
    version: '2.1.0'
  });
}
