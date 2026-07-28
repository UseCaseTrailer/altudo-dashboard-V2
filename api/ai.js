// api/ai.js — POST /api/ai — Anthropic + OpenAI proxy
module.exports = async function handler(req, res) {
  if(req.method === 'OPTIONS') return res.status(200).end();
  if(req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});

  const body = req.body;
  const provider = body.provider || 'anthropic';

  try {
    if(provider === 'openai'){
      const apiKey = process.env.OPENAI_API_KEY || body.openai_key;
      if(!apiKey) return res.status(500).json({
        error:'OpenAI key not configured. Add OPENAI_API_KEY in Vercel → Settings → Environment Variables.'
      });
      const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
        body: JSON.stringify({
          model: body.model || 'gpt-4o-mini',   // gpt-4o-mini = 10x higher rate limits
          max_tokens: body.max_tokens || 1800,
          messages: body.messages || []
        })
      });
      const data = await upstream.json();
      if(!upstream.ok){
        const msg = data.error?.message || `OpenAI error ${upstream.status}`;
        return res.status(upstream.status).json({error: msg});
      }
      // Normalise to Anthropic shape so dashboard JS works for both
      const text = data.choices?.[0]?.message?.content || '';
      return res.status(200).json({content:[{type:'text', text}], model: data.model});

    } else {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if(!apiKey) return res.status(500).json({
        error:'ANTHROPIC_API_KEY not configured in Vercel environment variables.'
      });
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
        body: JSON.stringify({
          model: body.model || 'claude-sonnet-4-5-20251001',
          max_tokens: body.max_tokens || 1800,
          system: body.system || '',
          messages: body.messages || []
        })
      });
      const data = await upstream.json();
      if(!upstream.ok){
        const msg = data.error?.message || `Anthropic error ${upstream.status}`;
        return res.status(upstream.status).json({error: msg});
      }
      return res.status(200).json(data);
    }
  } catch(err) {
    return res.status(500).json({error: err.message});
  }
}
