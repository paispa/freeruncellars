// api/generate-post.js — Facebook Post Generator (server-side Anthropic proxy)

const { applyCors, makeRateLimiter, getClientIp } = require('./_helpers');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Max 20 post generations per IP per 60 seconds
const isRateLimited = makeRateLimiter(20, 60_000);

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body) return resolve(req.body);
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch(e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    if (!applyCors(req, res)) return res.status(403).end();
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!applyCors(req, res)) return res.status(403).json({ error: 'Forbidden' });

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    console.warn('generate-post rate limit hit:', ip);
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const ALLOWED_MODELS = {
    'claude-haiku-4-5-20251001': true,
    'claude-sonnet-4-6': true,
  };

  try {
    const body = await parseBody(req);
    const { systemPrompt, userPrompt, model } = body;

    if (!systemPrompt || !userPrompt) {
      return res.status(400).json({ error: 'systemPrompt and userPrompt are required' });
    }

    const selectedModel = ALLOWED_MODELS[model] ? model : 'claude-haiku-4-5-20251001';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      return res.status(502).json({ error: 'AI service error', detail: err });
    }

    const data = await response.json();
    const text = data.content?.map(c => c.text || '').join('') || '';
    return res.status(200).json({ post: text });

  } catch (err) {
    console.error('generate-post handler error:', err);
    return res.status(500).json({ error: err.message });
  }
};
