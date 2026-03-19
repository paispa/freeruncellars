// api/contact.js
// Contact form submissions → notification email to contact@frcwine.com via Brevo
// Requires env var: BREVO_API_KEY

const { applyCors, makeRateLimiter, getClientIp, escapeHtml } = require('./_helpers');

// 5 submissions per IP per 10 minutes
const isRateLimited = makeRateLimiter(5, 10 * 60_000);

const INQUIRY_LABELS = {
  perform:    'Perform at Free Run Cellars',
  party:      'Host a party or private event',
  foodtruck:  'Bring a food truck',
  activity:   'Host an activity (yoga, art, etc.)',
  other:      'General inquiry',
};

const INQUIRY_EMOJI = {
  perform:   '🎵',
  party:     '🎉',
  foodtruck: '🚚',
  activity:  '🧘',
  other:     '✉️',
};

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
    return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const { name, email, phone, eventDate, inquiry, message, _hp } = body;

  // Honeypot
  if (_hp) return res.status(200).json({ ok: true });

  if (!name || !email || !email.includes('@')) {
    return res.status(400).json({ error: 'Name and a valid email address are required.' });
  }

  const inquiryKey   = INQUIRY_LABELS[inquiry] ? inquiry : 'other';
  const inquiryLabel = INQUIRY_LABELS[inquiryKey];
  const inquiryEmoji = INQUIRY_EMOJI[inquiryKey];

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error('Missing BREVO_API_KEY env var');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  const safeName      = escapeHtml(name);
  const safeEmail     = escapeHtml(email);
  const safePhone     = escapeHtml(phone || '');
  const safeEventDate = escapeHtml(eventDate || '');
  const safeMessage   = escapeHtml(message || '');
  const safeInquiry   = escapeHtml(inquiryLabel);

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const phoneRow = safePhone
    ? `<tr><td style="padding:8px 0;color:#777;">Phone</td><td style="padding:8px 0;color:#222;">${safePhone}</td></tr>`
    : '';

  // Format ISO date string (YYYY-MM-DD) as human-readable for the email
  let formattedDate = '';
  if (safeEventDate) {
    const d = new Date(safeEventDate + 'T12:00:00'); // noon to avoid TZ drift
    formattedDate = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  const eventDateRow = formattedDate
    ? `<tr><td style="padding:8px 0;color:#777;">Event date</td><td style="padding:8px 0;color:#222;">${escapeHtml(formattedDate)}</td></tr>`
    : '';

  const msgRow = safeMessage
    ? `<tr><td style="padding:8px 0;color:#777;vertical-align:top;">Message</td><td style="padding:8px 0;color:#222;font-style:italic;">&ldquo;${safeMessage}&rdquo;</td></tr>`
    : '';

  const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      sender:  { name: 'Free Run Cellars Website', email: 'contact@frcwine.com' },
      to:      [{ email: 'contact@frcwine.com', name: 'Free Run Cellars' }],
      replyTo: { email, name: safeName },
      subject: `${inquiryEmoji} ${inquiryLabel} — ${safeName}`,
      htmlContent: `
        <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px;background:#f9f7f4;border-radius:12px;">
          <h2 style="color:#3d6155;font-size:22px;margin-bottom:4px;">${inquiryEmoji} New Inquiry</h2>
          <p style="color:#999;font-size:12px;margin-bottom:24px;">${dateStr}</p>
          <table style="width:100%;font-size:14px;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#777;width:110px;">Type</td><td style="padding:8px 0;font-weight:600;color:#537f71;">${safeInquiry}</td></tr>
            <tr><td style="padding:8px 0;color:#777;">Name</td><td style="padding:8px 0;font-weight:600;color:#222;">${safeName}</td></tr>
            <tr><td style="padding:8px 0;color:#777;">Email</td><td style="padding:8px 0;"><a href="mailto:${safeEmail}" style="color:#537f71;">${safeEmail}</a></td></tr>
            ${phoneRow}
            ${eventDateRow}
            ${msgRow}
          </table>
          <p style="margin-top:24px;padding-top:16px;border-top:1px solid #e0dbd4;font-size:11px;color:#bbb;">Free Run Cellars · freeruncellars.com</p>
        </div>
      `,
    }),
  });

  if (!emailRes.ok) {
    const errText = await emailRes.text();
    console.error('Brevo contact email failed:', emailRes.status, errText);
    return res.status(502).json({ error: 'Could not send your message. Please try again or call us directly.' });
  }

  return res.status(200).json({ ok: true });
};
