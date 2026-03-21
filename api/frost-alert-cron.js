// api/frost-alert-cron.js — Daily 6 AM frost alert cron (runs at 0 11 * * * UTC = 6 AM CDT)
// Required env vars:
//   CRON_SECRET        — Authorization header must equal "Bearer <CRON_SECRET>"
//   BREVO_API_KEY      — send alert emails
//   KV_REST_API_URL    — Vercel KV (optional, graceful fallback)
//   KV_REST_API_TOKEN  — Vercel KV (optional, graceful fallback)

const {
  STAGES, getCurrentStageIdx, getFrostWarnings,
  sendBrevoEmail, kvGet, kvSet,
  forecastUrl, parseForecast,
} = require('./_vineyard');

// ── Email template ───────────────────────────────────────────────────────────
function buildCronAlertHtml(warnings, currentGDD, stageLabel, budBreakRecorded) {
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
        ⚠️ Bud break recorded — vines are actively growing and susceptible to frost damage.
       </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0; padding:0; background:#f4f4f4; font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px; margin:32px auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 16px rgba(0,0,0,0.08);">
    <div style="background:#537f71; padding:28px 32px;">
      <div style="font-family:Georgia,serif; font-style:italic; font-size:13px; color:rgba(255,255,255,0.7); letter-spacing:2px; text-transform:uppercase; margin-bottom:6px;">Free Run Cellars · Daily Check</div>
      <h1 style="margin:0; color:#fff; font-family:Georgia,serif; font-style:italic; font-weight:300; font-size:28px; line-height:1.2;">
        ❄️ Frost Alert
      </h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#444; font-size:14px; line-height:1.7; margin:0 0 12px;">
        The morning vineyard check detected frost conditions in the 10-day forecast for Berrien Springs, MI.
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
      <div style="background:#eef4f1; border-radius:6px; padding:16px; margin-bottom:24px;">
        <p style="margin:0; font-size:12px; color:#537f71; font-weight:600; letter-spacing:1px; text-transform:uppercase; margin-bottom:6px;">What to do</p>
        <ul style="margin:0; padding-left:16px; color:#555; font-size:13px; line-height:1.8;">
          <li>Check bud development stage before deciding on protection measures</li>
          <li>Consider wind machine activation for temps approaching 30°F</li>
          <li>Monitor overnight lows — coldest temps typically occur just before dawn</li>
        </ul>
      </div>
      <hr style="border:none; border-top:1px solid #eef4f1; margin:0 0 20px;">
      <p style="color:#aaa; font-size:11px; line-height:1.7; margin:0;">
        Sent by the Free Run Cellars automated morning vineyard check.
        <a href="https://www.frcwine.com/tools/vineyard-season.html" style="color:#537f71;">View full season dashboard →</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Verify cron secret
  const authHeader = req.headers.authorization || '';
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  try {
    // Fetch 10-day forecast
    const fRes  = await fetch(forecastUrl());
    const fData = await fRes.json();
    const days  = parseForecast(fData);

    // Get frost warnings
    const warnings = getFrostWarnings(days);

    if (warnings.length === 0) {
      console.log('[frost-alert-cron] No frost warnings detected — no email sent');
      return res.json({ ok: true, sent: false, reason: 'no_warnings', checked: days.length });
    }

    // Get current GDD from KV (stored by the staff tool on last open)
    const [gddRaw, budBreakRaw] = await Promise.all([
      kvGet('frc_current_gdd'),
      kvGet('frc_bud_break_recorded'),
    ]);

    const currentGDD       = gddRaw ? Number(gddRaw) : 0;
    const stageIdx         = getCurrentStageIdx(currentGDD);
    const stageLabel       = STAGES[stageIdx].label;
    const budBreakRecorded = budBreakRaw === '1';

    await sendBrevoEmail({
      subject: `⚠️ Frost Alert — Free Run Cellars · ${warnings.map(w => w.date).join(', ')}`,
      htmlContent: buildCronAlertHtml(warnings, currentGDD, stageLabel, budBreakRecorded),
    });

    // Record last alert sent time
    await kvSet('frc_last_frost_alert', new Date().toISOString());

    console.log(`[frost-alert-cron] Sent alert for ${warnings.length} warning(s)`);
    return res.json({ ok: true, sent: true, warningCount: warnings.length });

  } catch (err) {
    console.error('[frost-alert-cron]', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
