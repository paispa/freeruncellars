// api/circle-signup.js
// Owners Circle signup — adds contact to Brevo and notifies Trish & Prashanth
// Requires env vars: BREVO_API_KEY, BREVO_CIRCLE_LIST_ID

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { firstName, lastName, email, phone, message, interests } = req.body || {};

  if (!firstName || !email || !email.includes('@') || !phone) {
    return res.status(400).json({ error: 'First name, valid email, and phone are required.' });
  }

  const apiKey = process.env.BREVO_API_KEY;
  const listId = parseInt(process.env.BREVO_CIRCLE_LIST_ID, 10);

  if (!apiKey || !listId) {
    console.error('Missing BREVO_API_KEY or BREVO_CIRCLE_LIST_ID env vars');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  const INTEREST_LABELS = {
    ramato:  'First access to new wines',
    credits: '$150 credits + ongoing discount',
    events:  'Private tastings & owner-only events',
    tickets: 'Early access to live music tickets',
    updates: 'Behind-the-scenes vineyard updates',
  };

  const interestList = (interests && interests.length)
    ? interests.map(i => INTEREST_LABELS[i] || i).join(', ')
    : 'Not specified';

  const headers = { 'Content-Type': 'application/json', 'api-key': apiKey };

  // Normalize phone to E.164 for Brevo SMS attribute
  let smsPhone = undefined;
  if (phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) smsPhone = `+1${digits}`;
    else if (digits.length === 11 && digits.startsWith('1')) smsPhone = `+${digits}`;
  }

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

  // 2 — Notify Trish & Prashanth
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const phoneRow  = phone   ? `<tr><td style="padding:8px 0;color:#777;">Phone</td><td style="padding:8px 0;color:#222;">${phone}</td></tr>` : '';
  const msgRow    = message ? `<tr><td style="padding:8px 0;color:#777;vertical-align:top;">Message</td><td style="padding:8px 0;color:#222;font-style:italic;">&ldquo;${message}&rdquo;</td></tr>` : '';

  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      sender:      { name: 'Free Run Circle', email: 'contact@frcwine.com' },
      to:          [{ email: 'contact@frcwine.com', name: 'Free Run Cellars' }],
      replyTo:     { email, name: `${firstName} ${lastName || ''}`.trim() },
      subject:     `✦ New Owners Circle interest — ${firstName} ${lastName || ''}`.trim(),
      htmlContent: `
        <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px;background:#f9f7f4;border-radius:12px;">
          <h2 style="color:#3d6155;font-size:22px;margin-bottom:4px;">New Owners Circle Interest</h2>
          <p style="color:#999;font-size:12px;margin-bottom:24px;">${dateStr}</p>
          <table style="width:100%;font-size:14px;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#777;width:110px;">Name</td><td style="padding:8px 0;font-weight:600;color:#222;">${firstName} ${lastName || ''}</td></tr>
            <tr><td style="padding:8px 0;color:#777;">Email</td><td style="padding:8px 0;"><a href="mailto:${email}" style="color:#537f71;">${email}</a></td></tr>
            ${phoneRow}
            <tr><td style="padding:8px 0;color:#777;vertical-align:top;">Interests</td><td style="padding:8px 0;color:#222;">${interestList}</td></tr>
            ${msgRow}
          </table>
          <p style="margin-top:24px;padding-top:16px;border-top:1px solid #e0dbd4;font-size:11px;color:#bbb;">Free Run Cellars · freeruncellars.com</p>
        </div>
      `,
    }),
  });

  return res.status(200).json({ ok: true });
}
