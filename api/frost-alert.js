// api/frost-alert.js
// Manual frost alert trigger + bud break KV sync — called from the staff tool
// Required env vars: BREVO_API_KEY, DASHBOARD_PASSWORD, KV_REST_API_URL, KV_REST_API_TOKEN

const { applyCors, getClientIp, makeRateLimiter } = require('./_helpers');
const {
  kvGet, kvSet, checkDedup, recordDedup,
  buildAlertEmailHtml, sendBrevoEmail,
  daysSincePruning, fmtDateRange,
} = require('./_vineyard');

const isRateLimited = makeRateLimiter(10, 60_000);

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
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  // Auth — require staff password on all POST actions
  if (!body.password || body.password !== process.env.DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ACTION 0: Auth check (no side effects — used by login gate)
  if (body.action === 'auth_check') {
    return res.status(200).json({ ok: true });
  }

  // ACTION 2: Sync bud break status to Vercel KV
  if (body.action === 'set_bud_break') {
    const value = body.value === true || body.value === 'true';
    await kvSet('frc_bud_break_recorded', String(value));
    console.log('[frost-alert] Bud break set to:', value, 'by IP:', ip);
    return res.status(200).json({ success: true });
  }

  // ACTION 1 + 3: Send alert email (or test email)
  const { warnings, currentGDD, currentStage, nextStage, nextStageEst, forecastDays, test } = body;

  if (!warnings || !Array.isArray(warnings)) {
    return res.status(400).json({ error: 'Missing warnings array' });
  }

  const isTest = test === true;
  const budBreakRecorded = (await kvGet('frc_bud_break_recorded')) === 'true';
  const daysSince = daysSincePruning();

  // Dedup check (skip for test emails)
  if (!isTest) {
    const warningKeys = warnings.map(w => w.key);
    if (await checkDedup(warningKeys)) {
      return res.status(200).json({ skipped: true, reason: 'duplicate' });
    }
  }

  const subjectBody = warnings.map(w => w.label.replace(/^⚠️\s*/, '')).join(' · ');
  const subject = isTest
    ? `(TEST) 🌿 FRC Vineyard Alert — ${subjectBody}`
    : `🌿 FRC Vineyard Alert — ${subjectBody}`;

  const html = buildAlertEmailHtml({
    warnings,
    currentGDD:    currentGDD   || 0,
    currentStage:  currentStage || null,
    nextStage:     nextStage    || null,
    nextStageEst:  nextStageEst || null,
    forecastDays:  forecastDays || [],
    budBreakRecorded,
    daysSince,
  });

  try {
    await sendBrevoEmail(subject, html);
    if (!isTest) await recordDedup(warnings.map(w => w.key));
    console.log('[frost-alert] Sent:', subject);
    return res.status(200).json({ sent: true });
  } catch (e) {
    console.error('[frost-alert] Send failed:', e.message);
    return res.status(502).json({ error: 'Email send failed' });
  }
};
