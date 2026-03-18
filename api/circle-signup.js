// api/circle-signup.js
// Owners Circle signup — adds contact to Brevo and notifies Trish & Prashanth
// Requires env vars: BREVO_API_KEY, BREVO_CIRCLE_LIST_ID

const {
  applyCors, makeRateLimiter, getClientIp,
  escapeHtml, INTERESTS_MAP, normalizePhone,
} = require('./_helpers');

// Max 5 signups per IP per 10 minutes
const isRateLimited = makeRateLimiter(5, 10 * 60_000);

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
    console.warn('circle-signup rate limit hit:', ip);
    return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};
  const { firstName, lastName, email, phone, message, interests, _hp } = body;

  // Honeypot: bots fill hidden fields, humans don't
  if (_hp) {
    console.warn('Honeypot triggered from IP:', ip);
    return res.status(200).json({ ok: true }); // silent reject
  }

  if (!firstName || !email || !email.includes('@') || !phone) {
    return res.status(400).json({ error: 'First name, valid email, and phone are required.' });
  }

  const apiKey = process.env.BREVO_API_KEY;
  const listId = parseInt(process.env.BREVO_CIRCLE_LIST_ID, 10);

  if (!apiKey || !listId) {
    console.error('Missing BREVO_API_KEY or BREVO_CIRCLE_LIST_ID env vars');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  const interestArray = Array.isArray(interests) ? interests : [];
  const interestList  = interestArray.length
    ? interestArray.map(i => INTERESTS_MAP[i]?.label || i).join(', ')
    : 'Not specified';

  const headers  = { 'Content-Type': 'application/json', 'api-key': apiKey };
  const smsPhone = normalizePhone(phone);

  // 1 — Add / update contact in Brevo Owners Circle list
  const contactAttributes = {
    FIRSTNAME:       firstName,
    LASTNAME:        lastName || '',
    INTERESTS:       interestList,
    MEMBERSHIP_TYPE: 'Owners Circle',
    JOIN_DATE:       new Date().toISOString().split('T')[0],
    CIRCLE_MESSAGE:  message || '',
    ...(smsPhone ? { SMS: smsPhone } : {}),
  };

  const contactRes = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      attributes: contactAttributes,
      listIds:       [listId],
      updateEnabled: true,
    }),
  });

  if (!contactRes.ok && contactRes.status !== 204) {
    const errText = await contactRes.text();
    console.error('Brevo contact error:', errText);

    let errJson = {};
    try { errJson = JSON.parse(errText); } catch (_) {}

    if (errJson.code === 'duplicate_parameter') {
      const dupes = errJson.metadata?.duplicate_identifiers ?? [];
      const which = dupes.includes('SMS') ? 'phone number' : 'email address';
      return res.status(409).json({
        error: `That ${which} is already in our system. If you think this is a mistake, please reach out to us at contact@frcwine.com and we'll sort it out.`,
      });
    }

    return res.status(502).json({ error: 'Could not save contact. Please try again.' });
  }

  // 2 — Notify Trish & Prashanth (HTML-escape all user-provided values)
  const safeFirst    = escapeHtml(firstName);
  const safeLast     = escapeHtml(lastName || '');
  const safeEmail    = escapeHtml(email);
  const safePhone    = escapeHtml(phone || '');
  const safeMessage  = escapeHtml(message || '');
  const safeInterests = escapeHtml(interestList);

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const phoneRow = safePhone
    ? `<tr><td style="padding:8px 0;color:#777;">Phone</td><td style="padding:8px 0;color:#222;">${safePhone}</td></tr>`
    : '';
  const msgRow = safeMessage
    ? `<tr><td style="padding:8px 0;color:#777;vertical-align:top;">Message</td><td style="padding:8px 0;color:#222;font-style:italic;">&ldquo;${safeMessage}&rdquo;</td></tr>`
    : '';

  const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sender:      { name: 'Free Run Circle', email: 'contact@frcwine.com' },
      to:          [{ email: 'contact@frcwine.com', name: 'Free Run Cellars' }],
      replyTo:     { email, name: `${safeFirst} ${safeLast}`.trim() },
      subject:     `✦ New Owners Circle interest — ${safeFirst} ${safeLast}`.trim(),
      htmlContent: `
        <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px;background:#f9f7f4;border-radius:12px;">
          <h2 style="color:#3d6155;font-size:22px;margin-bottom:4px;">New Owners Circle Interest</h2>
          <p style="color:#999;font-size:12px;margin-bottom:24px;">${dateStr}</p>
          <table style="width:100%;font-size:14px;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#777;width:110px;">Name</td><td style="padding:8px 0;font-weight:600;color:#222;">${safeFirst} ${safeLast}</td></tr>
            <tr><td style="padding:8px 0;color:#777;">Email</td><td style="padding:8px 0;"><a href="mailto:${safeEmail}" style="color:#537f71;">${safeEmail}</a></td></tr>
            ${phoneRow}
            <tr><td style="padding:8px 0;color:#777;vertical-align:top;">Interests</td><td style="padding:8px 0;color:#222;">${safeInterests}</td></tr>
            ${msgRow}
          </table>
          <p style="margin-top:24px;padding-top:16px;border-top:1px solid #e0dbd4;font-size:11px;color:#bbb;">Free Run Cellars · freeruncellars.com</p>
        </div>
      `,
    }),
  });

  if (!emailRes.ok) {
    const emailErrText = await emailRes.text();
    console.error('Brevo email notification failed:', emailRes.status, emailErrText);
    // Contact was saved; still return ok but flag partial success for logging
    return res.status(200).json({ ok: true, warning: 'signup_saved_notification_failed' });
  }

  return res.status(200).json({ ok: true });
};
