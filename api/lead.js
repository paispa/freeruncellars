// api/lead.js
// Receives a chat widget lead capture (name + email) and emails contact@frcwine.com
// Requires env var: BREVO_API_KEY

const { applyCors, makeRateLimiter, getClientIp, escapeHtml } = require('./_helpers');

// 10 lead submissions per IP per hour
const isRateLimited = makeRateLimiter(10, 60 * 60_000);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    if (!applyCors(req, res)) return res.status(403).end();
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!applyCors(req, res)) return res.status(403).json({ error: 'Forbidden' });

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const { name, email } = body;
  if (!name || !email || !email.includes('@')) {
    return res.status(400).json({ error: 'Name and valid email are required.' });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error('Missing BREVO_API_KEY env var');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  const safeName  = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const dateStr   = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      sender:      { name: 'Free Run Cellars Chat', email: 'contact@frcwine.com' },
      to:          [{ email: 'contact@frcwine.com', name: 'Free Run Cellars' }],
      replyTo:     { email, name: safeName },
      subject:     `💬 New chat lead — ${safeName}`,
      htmlContent: `
        <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px;background:#f9f7f4;border-radius:12px;">
          <h2 style="color:#3d6155;font-size:22px;margin-bottom:4px;">New Website Chat Lead</h2>
          <p style="color:#999;font-size:12px;margin-bottom:24px;">${dateStr}</p>
          <table style="width:100%;font-size:14px;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#777;width:80px;">Name</td><td style="padding:8px 0;font-weight:600;color:#222;">${safeName}</td></tr>
            <tr><td style="padding:8px 0;color:#777;">Email</td><td style="padding:8px 0;"><a href="mailto:${safeEmail}" style="color:#537f71;">${safeEmail}</a></td></tr>
            <tr><td style="padding:8px 0;color:#777;">Source</td><td style="padding:8px 0;color:#222;">Chat widget</td></tr>
          </table>
          <p style="margin-top:24px;padding-top:16px;border-top:1px solid #e0dbd4;font-size:11px;color:#bbb;">Free Run Cellars · freeruncellars.com</p>
        </div>
      `,
    }),
  });

  if (!emailRes.ok) {
    const errText = await emailRes.text();
    console.error('Brevo lead email failed:', emailRes.status, errText);
    return res.status(502).json({ error: 'Failed to send notification.' });
  }

  return res.status(200).json({ ok: true });
};
