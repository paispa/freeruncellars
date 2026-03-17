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

  if (!firstName || !email || !email.includes('@')) {
    return res.status(400).json({ error: 'First name and valid email are required.' });
  }

  const apiKey = process.env.BREVO_API_KEY;
  const listId = parseInt(process.env.BREVO_CIRCLE_LIST_ID, 10);

  if (!apiKey || !listId) {
    console.error('Missing BREVO_API_KEY or BREVO_CIRCLE_LIST_ID env vars');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  // Brevo multiple-choice option IDs (must match order defined in Brevo attribute settings)
  const INTEREST_IDS = {
    ramato:  1,
    credits: 2,
    events:  3,
    tickets: 4,
    updates: 5,
  };

  const INTEREST_LABELS = {
    ramato:  'First access to Ramato & Cab Blanc',
    credits: '$150 credits + ongoing discount',
    events:  'Private tastings & owner-only events',
    tickets: 'Early access to live music tickets',
    updates: 'Behind-the-scenes vineyard updates',
  };

  const interestIds  = (interests && interests.length)
    ? interests.map(i => INTEREST_IDS[i]).filter(Boolean)
    : [];
  const interestList = (interests && interests.length)
    ? interests.map(i => INTEREST_LABELS[i] || i).join(', ')
    : 'Not specified';

  const headers = { 'Content-Type': 'application/json', 'api-key': apiKey };

  // 1 — Add / update contact in Brevo Owners Circle list
  const contactRes = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      attributes: {
        FIRSTNAME:       firstName,
        LASTNAME:        lastName || '',
        SMS:             phone || '',
        INTERESTS:       interestIds,
        MEMBERSHIP_TYPE: 1,
        JOIN_DATE:       new Date().toISOString().split('T')[0],
        CIRCLE_MESSAGE:  message || '',
      },
      listIds:       [listId],
      updateEnabled: true,
    }),
  });

  if (!contactRes.ok && contactRes.status !== 204) {
    const err = await contactRes.text();
    console.error('Brevo contact error:', err);
    return res.status(502).json({ error: 'Could not save contact. Please try again.', brevo: err });
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
