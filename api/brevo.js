// api/brevo.js
// Unified Brevo endpoint — routes by `type` field in request body:
//   { type: 'circle', ... }   → Owners Circle signup
//   { type: 'contact', ... }  → Contact form inquiry
//   { type: 'lead', ... }     → Chat widget lead capture
//   { type: 'wifi', ... }     → WiFi guest sign-up
//
// Requires env vars: BREVO_API_KEY, BREVO_CIRCLE_LIST_ID,
//                    BREVO_NEWSLETTER_LIST_ID, BREVO_SMS_LIST_ID

const {
  applyCors, makeRateLimiter, getClientIp,
  escapeHtml, INTERESTS_MAP, normalizePhone,
} = require('./_helpers');

// Per-type rate limiters (matching original limits)
const circleRateLimit  = makeRateLimiter(5,  10 * 60_000);  // 5 per 10 min
const contactRateLimit = makeRateLimiter(5,  10 * 60_000);  // 5 per 10 min
const leadRateLimit    = makeRateLimiter(10, 60 * 60_000);  // 10 per hour
const wifiRateLimit    = makeRateLimiter(10, 10 * 60_000);  // 10 per 10 min

const BREVO_API = 'https://api.brevo.com/v3';

// ─── inquiry type maps (contact handler) ─────────────────────────────────────
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

// ─── Route handlers ───────────────────────────────────────────────────────────

async function handleCircle(body, ip, res) {
  if (circleRateLimit(ip)) {
    console.warn('circle rate limit hit:', ip);
    return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
  }

  const { firstName, lastName, email, phone, message, interests, _hp } = body;

  if (_hp) {
    console.warn('Honeypot triggered from IP:', ip);
    return res.status(200).json({ ok: true });
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

  const contactAttributes = {
    FIRSTNAME:       firstName,
    LASTNAME:        lastName || '',
    INTERESTS:       interestList,
    MEMBERSHIP_TYPE: 'Owners Circle',
    JOIN_DATE:       new Date().toISOString().split('T')[0],
    CIRCLE_MESSAGE:  message || '',
    ...(smsPhone ? { SMS: smsPhone } : {}),
  };

  const contactRes = await fetch(`${BREVO_API}/contacts`, {
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

  const emailRes = await fetch(`${BREVO_API}/smtp/email`, {
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
    return res.status(200).json({ ok: true, warning: 'signup_saved_notification_failed' });
  }

  return res.status(200).json({ ok: true });
}

async function handleContact(body, ip, res) {
  if (contactRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
  }

  const { name, email, phone, optIn, eventDate, inquiry, message, _hp } = body;

  if (_hp) return res.status(200).json({ ok: true });

  if (!name || !email || !email.includes('@')) {
    return res.status(400).json({ error: 'Name and a valid email address are required.' });
  }
  if (optIn && !phone) {
    return res.status(400).json({ error: 'Phone number is required to join the mailing list.' });
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

  let formattedDate = '';
  if (safeEventDate) {
    const d = new Date(safeEventDate + 'T12:00:00');
    formattedDate = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  const eventDateRow = formattedDate
    ? `<tr><td style="padding:8px 0;color:#777;">Event date</td><td style="padding:8px 0;color:#222;">${escapeHtml(formattedDate)}</td></tr>`
    : '';

  const msgRow = safeMessage
    ? `<tr><td style="padding:8px 0;color:#777;vertical-align:top;">Message</td><td style="padding:8px 0;color:#222;font-style:italic;">&ldquo;${safeMessage}&rdquo;</td></tr>`
    : '';
  const optInRow = optIn
    ? `<tr><td style="padding:8px 0;color:#777;">Mailing list</td><td style="padding:8px 0;color:#3a7d5a;font-weight:600;">✓ Opted in</td></tr>`
    : '';

  const emailRes = await fetch(`${BREVO_API}/smtp/email`, {
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
            ${optInRow}
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

  if (optIn) {
    const nameParts   = name.trim().split(/\s+/);
    const firstName   = nameParts[0];
    const lastName    = nameParts.slice(1).join(' ') || '';
    const normalizedPhone = normalizePhone(phone);

    const listRes = await fetch(`${BREVO_API}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({
        email,
        attributes: {
          FIRSTNAME: firstName,
          LASTNAME:  lastName,
          SMS:       normalizedPhone,
        },
        listIds:       [11],
        updateEnabled: true,
      }),
    });

    if (!listRes.ok) {
      const errText = await listRes.text();
      console.warn('Brevo list add failed (non-fatal):', listRes.status, errText);
    }
  }

  return res.status(200).json({ ok: true });
}

async function handleLead(body, ip, res) {
  if (leadRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

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

  const emailRes = await fetch(`${BREVO_API}/smtp/email`, {
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
}

async function handleWifi(body, ip, res) {
  if (wifiRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const { name, email, phone, newsletter, sms, visits } = body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error('wifi-signup: BREVO_API_KEY not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const attributes = {
    WIFI_VISITS:     Number(visits) || 1,
    WIFI_LAST_VISIT: new Date().toISOString().slice(0, 10),
    SMS_OPT_IN:      Boolean(sms),
  };

  if (name) {
    attributes.FIRSTNAME = name.split(' ')[0];
    attributes.LASTNAME  = name.split(' ').slice(1).join(' ') || undefined;
  }

  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      attributes.SMS = `+1${digits.slice(-10)}`;
    }
  }

  const listIds = [];
  const newsletterListId = Number(process.env.BREVO_NEWSLETTER_LIST_ID);
  const smsListId        = Number(process.env.BREVO_SMS_LIST_ID);

  if (newsletter && newsletterListId) listIds.push(newsletterListId);
  if (sms && smsListId)               listIds.push(smsListId);

  Object.keys(attributes).forEach(k => {
    if (attributes[k] === undefined) delete attributes[k];
  });

  const payload = {
    email,
    attributes,
    updateEnabled: true,
    ...(listIds.length > 0 && { listIds }),
  };

  try {
    const brevoRes = await fetch(`${BREVO_API}/contacts`, {
      method: 'POST',
      headers: {
        'accept':       'application/json',
        'content-type': 'application/json',
        'api-key':      apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (brevoRes.status === 201 || brevoRes.status === 204) {
      return res.status(200).json({ ok: true });
    }

    const responseBody = await brevoRes.json().catch(() => ({}));
    if (responseBody.code === 'duplicate_parameter') {
      return res.status(200).json({ ok: true });
    }

    console.error('wifi-signup: Brevo error', brevoRes.status, responseBody);
    return res.status(502).json({ error: 'Upstream error', detail: responseBody });

  } catch (err) {
    console.error('wifi-signup: fetch error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

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

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const { type } = body;

  switch (type) {
    case 'circle':  return handleCircle(body, ip, res);
    case 'contact': return handleContact(body, ip, res);
    case 'lead':    return handleLead(body, ip, res);
    case 'wifi':    return handleWifi(body, ip, res);
    default:
      return res.status(400).json({ error: 'Unknown request type.' });
  }
};
