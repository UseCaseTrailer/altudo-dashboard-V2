// POST /api/ai
// Server-only OpenAI Responses API gateway for grounded portfolio Q&A.
const {
  buildInstructions,
  buildInput,
  extractOutputText,
  normaliseRequest
} = require('../lib/ai');

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({error: 'Method not allowed'});

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'ChatGPT is not configured. Add OPENAI_API_KEY in Vercel → Settings → Environment Variables, then redeploy.'
    });
  }

  try {
    const request = normaliseRequest(req.body || {});
    if (!request.question) {
      return res.status(400).json({error: 'A question is required.'});
    }

    const model = process.env.OPENAI_MODEL || 'gpt-5.6';
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        instructions: buildInstructions(request.mode),
        input: buildInput(request),
        reasoning: {
          effort: process.env.OPENAI_REASONING_EFFORT || 'low'
        },
        max_output_tokens: request.maxOutputTokens,
        store: false
      })
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      const message = data.error?.message || `OpenAI error ${upstream.status}`;
      return res.status(upstream.status).json({error: message});
    }

    const text = extractOutputText(data);
    if (!text) {
      return res.status(502).json({
        error: data.status === 'incomplete'
          ? 'ChatGPT could not finish within the response limit. Please ask a narrower question.'
          : 'ChatGPT returned no readable answer.'
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      text,
      model: data.model || model,
      responseId: data.id || null,
      status: data.status || 'completed',
      usage: data.usage || null,
      asOf: request.context?.asOf || null
    });
  } catch (error) {
    const status = error.code === 'INVALID_AI_REQUEST' ? 400 : 500;
    return res.status(status).json({error: error.message});
  }
}
