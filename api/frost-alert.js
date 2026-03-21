// api/frost-alert.js — Manual frost alert endpoint for Free Run Cellars
// Required env vars:
//   BREVO_API_KEY      — send alert emails
//   KV_REST_API_URL    — Vercel KV (optional, graceful fallback)
//   KV_REST_API_TOKEN  — Vercel KV (optional, graceful fallback)

const {
  STAGES, getCurrentStageIdx, getFrostWarnings,
  sendBrevoEmail, kvGet, kvSet,
  forecastUrl, parseForecast,
} = require('./_vineyard');

// ── Email template ───────────────────────────────────────────────────────────
function buildAlertHtml(warnings, currentGDD, stageLabel, budBreakRecorded, isTest) {
  const warningRows = warnings.map(w => `
    <tr>
      <td style="padding:14px 16px; border-bottom:1px solid #eef4f1;">
        <div style="font-weight:600; color:${w.severity === 'critical' ? '#c0392b' : '#d68910'}; font-size:13px; margin-bottom:4px;">
          ${w.label} · ${w.date}
        </div>
        <div style="color:#555; font-size:13px; line-height:1.6;">${w.msg}</div>
      </td>
    </tr>`).join('');

  const budBreakNote = budBreakRecorded
    ? `<div style="background:#fef9e7; border-left:3px solid #d68910; padding:12px 16px; margin-bottom:24px; border-radius:0 4px 4px 0; font-size:13px; color:#7d6608;">
        ⚠️ Bud break has been recorded — vines are actively growing and susceptible to frost damage.
       </div>`
    : '';

  const testBanner = isTest
    ? `<div style="background:#eef4f1; padding:10px 16px; text-align:center; font-size:11px; letter-spacing:2px; text-transform:uppercase; color:#537f71; font-weight:600;">
        TEST ALERT — No action required
       </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0; padding:0; background:#f4f4f4; font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px; margin:32px auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 16px rgba(0,0,0,0.08);">
    ${testBanner}
    <div style="background:#537f71; padding:28px 32px;">
      <div style="font-family:Georgia,serif; font-style:italic; font-size:13px; color:rgba(255,255,255,0.7); letter-spacing:2px; text-transform:uppercase; margin-bottom:6px;">Free Run Cellars</div>
      <h1 style="margin:0; color:#fff; font-family:Georgia,serif; font-style:italic; font-weight:300; font-size:28px; line-height:1.2;">
        Vineyard Frost Alert
      </h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#444; font-size:14px; line-height:1.7; margin:0 0 12px;">
        Frost conditions have been detected for the Free Run Cellars vineyard in Berrien Springs, MI.
      </p>
      <p style="color:#888; font-size:12px; margin:0 0 24px;">
        Current GDD: <strong style="color:#537f71;">${currentGDD}</strong> &nbsp;·&nbsp; Stage: <strong>${stageLabel}</strong>
      </p>
      ${budBreakNote}
      <table style="width:100%; border-collapse:collapse; border:1px solid #eef4f1; border-radius:6px; overflow:hidden; margin-bottom:24px;">
        <thead>
          <tr style="background:#eef4f1;">
            <th style="padding:12px 16px; text-align:left; font-size:10px; letter-spacing:2.5px; text-transform:uppercase; color:#537f71; font-weight:600;">Warning Details</th>
          </tr>
        </thead>
        <tbody>${warningRows}</tbody>
      </table>
      <hr style="border:none; border-top:1px solid #eef4f1; margin:0 0 20px;">
      <p style="color:#aaa; font-size:11px; line-height:1.7; margin:0;">
        Sent automatically by the Free Run Cellars vineyard monitoring system.
        Questions? Reply to this email or visit the
        <a href="https://www.frcwine.com/tools/vineyard-season.html" style="color:#537f71;">vineyard season tool</a>.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ── POST actions ─────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

      // Set bud break flag in KV
      if (body.action === 'set_bud_break') {
        const value = body.value ? '1' : '0';
        await kvSet('frc_bud_break_recorded', value);
        return res.json({ ok: true, budBreakRecorded: body.value });
      }

      // Send alert (manual trigger or test)
      if (body.action === 'send_alert' || body.test === true) {
        const isTest = body.test === true;

        // Fetch forecast to compute real warnings unless warnings were passed in
        let warnings = body.warnings || null;
        if (!warnings) {
          const fRes = await fetch(forecastUrl());
          const fData = await fRes.json();
          const days = parseForecast(fData);
          warnings = getFrostWarnings(days);
        }

        // For test mode we send even with no real warnings
        if (warnings.length === 0 && !isTest) {
          return res.json({ ok: true, sent: false, reason: 'no_warnings' });
        }

        const currentGDD       = body.currentGDD   || 0;
        const stageIdx         = getCurrentStageIdx(currentGDD);
        const stageLabel       = STAGES[stageIdx].label;
        const budBreakRaw      = await kvGet('frc_bud_break_recorded');
        const budBreakRecorded = budBreakRaw === '1';

        const testWarnings = isTest && warnings.length === 0
          ? [{ type: 'test', label: 'Test Alert', date: new Date().toISOString().slice(0, 10), tmin: 33, severity: 'warning', msg: 'This is a test alert from the Free Run Cellars vineyard tool. No frost is expected.' }]
          : warnings;

        const subject = isTest
          ? '(TEST) Free Run Cellars — Vineyard Frost Alert'
          : `⚠️ Frost Alert — Free Run Cellars · ${testWarnings.map(w => w.date).join(', ')}`;

        await sendBrevoEmail({
          subject,
          htmlContent: buildAlertHtml(testWarnings, currentGDD, stageLabel, budBreakRecorded, isTest),
        });

        return res.json({ ok: true, sent: true, isTest, warningCount: testWarnings.length });
      }

      return res.status(400).json({ ok: false, error: 'Unknown action' });
    }

    // ── GET — return current frost status ────────────────────────────────────
    const [fRes, budBreakRaw] = await Promise.all([
      fetch(forecastUrl()),
      kvGet('frc_bud_break_recorded'),
    ]);

    const fData            = await fRes.json();
    const forecastDays     = parseForecast(fData);
    const warnings         = getFrostWarnings(forecastDays);
    const budBreakRecorded = budBreakRaw === '1';

    return res.json({
      ok: true,
      warnings,
      budBreakRecorded,
      forecast: forecastDays,
    });

  } catch (err) {
    console.error('[frost-alert]', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
