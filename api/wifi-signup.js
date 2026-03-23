// api/wifi-signup.js — Free Run Cellars WiFi Guest Sign-up
// Receives guest info from the captive portal and creates/updates a contact in Brevo.
//
// Required env vars:
//   BREVO_API_KEY              — Brevo (Sendinblue) API key
//   BREVO_NEWSLETTER_LIST_ID   — Brevo list ID for the email newsletter
//   BREVO_SMS_LIST_ID          — Brevo list ID for SMS / text alerts

const BREVO_API = 'https://api.brevo.com/v3';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, phone, newsletter, sms, visits } = req.body || {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error('wifi-signup: BREVO_API_KEY not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Build Brevo contact attributes
  const attributes = {
    WIFI_VISITS:     Number(visits) || 1,
    WIFI_LAST_VISIT: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
    SMS_OPT_IN:      Boolean(sms),
  };

  if (name) {
    // Store just the first word as first name
    attributes.FIRSTNAME = name.split(' ')[0];
    attributes.LASTNAME  = name.split(' ').slice(1).join(' ') || undefined;
  }

  // Digits-only phone for Brevo's SMS field
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 10) {
      attributes.SMS = `+1${digits.slice(-10)}`;
    }
  }

  // Determine which lists to add the contact to
  const listIds = [];
  const newsletterListId = Number(process.env.BREVO_NEWSLETTER_LIST_ID);
  const smsListId        = Number(process.env.BREVO_SMS_LIST_ID);

  if (newsletter && newsletterListId) listIds.push(newsletterListId);
  if (sms && smsListId)               listIds.push(smsListId);

  // Remove undefined values from attributes
  Object.keys(attributes).forEach(k => {
    if (attributes[k] === undefined) delete attributes[k];
  });

  const payload = {
    email,
    attributes,
    updateEnabled: true, // create OR update — no duplicate errors
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

    // 201 = created, 204 = updated — both are success
    if (brevoRes.status === 201 || brevoRes.status === 204) {
      return res.status(200).json({ ok: true });
    }

    // Brevo returns 400 with code "duplicate_parameter" when contact already
    // exists AND updateEnabled is somehow false — treat as success anyway.
    const body = await brevoRes.json().catch(() => ({}));
    if (body.code === 'duplicate_parameter') {
      return res.status(200).json({ ok: true });
    }

    console.error('wifi-signup: Brevo error', brevoRes.status, body);
    return res.status(502).json({ error: 'Upstream error', detail: body });

  } catch (err) {
    console.error('wifi-signup: fetch error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
