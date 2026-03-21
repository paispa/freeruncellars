// api/weekend-forecast-cron.js — Friday 10 AM forecast cron (runs at 0 15 * * 5 UTC = 10 AM CDT)
// Required env vars:
//   CRON_SECRET        — Authorization header must equal "Bearer <CRON_SECRET>"
//   BREVO_API_KEY      — send forecast emails
//   KV_REST_API_URL    — Vercel KV (optional, graceful fallback)
//   KV_REST_API_TOKEN  — Vercel KV (optional, graceful fallback)

const {
  STAGES, getCurrentStageIdx, getFrostWarnings,
  scoreVisitorDay, DAY_SCORES,
  weatherEmoji, weatherDesc,
  sendBrevoEmail, kvGet,
  forecastUrl, parseForecast,
} = require('./_vineyard');

// ── Day-of-week label ────────────────────────────────────────────────────────
function dayLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

// ── Badge pill ───────────────────────────────────────────────────────────────
function scoreBadge(score) {
  return `<span style="display:inline-block; padding:2px 10px; border-radius:12px; background:${score.color}20; color:${score.color}; font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; border:1px solid ${score.color}40;">${score.label}</span>`;
}

// ── Email template ───────────────────────────────────────────────────────────
function buildWeekendHtml(weekendDays, allDays, currentGDD, stageLabel, frostWarnings) {
  const weekendRows = weekendDays.map(day => {
    const score     = scoreVisitorDay(day.tmax, day.tmin, day.precip, day.code);
    const emoji     = weatherEmoji(day.code);
    const desc      = weatherDesc(day.code);
    const hasFrost  = frostWarnings.some(w => w.date === day.date);
    const frostNote = hasFrost
      ? `<div style="margin-top:8px; font-size:12px; color:#d68910; font-weight:600;">❄️ Frost risk overnight</div>`
      : '';

    return `
    <tr>
      <td style="padding:18px 20px; border-bottom:1px solid #eef4f1;">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div>
            <div style="font-size:15px; font-weight:600; color:#2c2c2c; margin-bottom:4px;">
              ${emoji} ${dayLabel(day.date)}
            </div>
            <div style="font-size:13px; color:#707271; line-height:1.5;">
              ${desc} · ${Math.round(day.tmax)}°F / ${Math.round(day.tmin)}°F · ${day.precip}% precip
            </div>
            ${frostNote}
          </div>
          <div>${scoreBadge(score)}</div>
        </div>
      </td>
    </tr>`;
  }).join('');

  const hasFrostAny = frostWarnings.length > 0;
  const frostBlock = hasFrostAny
    ? `<div style="background:#fef9e7; border-left:3px solid #d68910; padding:14px 18px; margin-bottom:24px; border-radius:0 4px 4px 0;">
        <div style="font-size:12px; font-weight:700; color:#d68910; letter-spacing:1px; text-transform:uppercase; margin-bottom:6px;">❄️ Frost Risk in 10-Day Window</div>
        ${frostWarnings.map(w => `<div style="font-size:13px; color:#555; line-height:1.6;">${w.date}: ${w.msg}</div>`).join('')}
       </div>`
    : '';

  // Upcoming week strip (Mon–Fri)
  const weekStrip = allDays.slice(2, 7).map(day => {
    const s = scoreVisitorDay(day.tmax, day.tmin, day.precip, day.code);
    const d = new Date(day.date + 'T12:00:00');
    const wd = d.toLocaleDateString('en-US', { weekday: 'short' });
    return `
      <td style="text-align:center; padding:10px 8px; border-right:1px solid #eef4f1;">
        <div style="font-size:10px; color:#aaa; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">${wd}</div>
        <div style="font-size:16px; margin-bottom:4px;">${weatherEmoji(day.code)}</div>
        <div style="font-size:11px; color:#537f71; font-weight:600;">${Math.round(day.tmax)}°</div>
        <div style="font-size:10px; color:#aaa;">${Math.round(day.tmin)}°</div>
      </td>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0; padding:0; background:#f4f4f4; font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px; margin:32px auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 16px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg, #3d6155, #537f71); padding:28px 32px;">
      <div style="font-family:Georgia,serif; font-style:italic; font-size:13px; color:rgba(255,255,255,0.7); letter-spacing:2px; text-transform:uppercase; margin-bottom:6px;">Free Run Cellars · Weekend Forecast</div>
      <h1 style="margin:0; color:#fff; font-family:Georgia,serif; font-style:italic; font-weight:300; font-size:28px; line-height:1.2;">
        Weekend Weather & Vineyard Update
      </h1>
    </div>

    <div style="padding:32px 32px 0;">
      <div style="background:#eef4f1; border-radius:6px; padding:14px 18px; margin-bottom:24px; display:flex; align-items:center; gap:16px;">
        <div>
          <div style="font-size:10px; color:#537f71; font-weight:700; letter-spacing:2px; text-transform:uppercase; margin-bottom:3px;">Season Status</div>
          <div style="font-size:14px; color:#2c2c2c; font-weight:600;">${stageLabel} · ${currentGDD} GDD accumulated</div>
        </div>
      </div>
      ${frostBlock}
    </div>

    <div style="padding:0 32px;">
      <div style="font-size:10px; color:#537f71; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; margin-bottom:12px;">This Weekend</div>
      <table style="width:100%; border-collapse:collapse; border:1px solid #eef4f1; border-radius:6px; overflow:hidden; margin-bottom:24px;">
        <tbody>${weekendRows}</tbody>
      </table>
    </div>

    <div style="padding:0 32px 32px;">
      <div style="font-size:10px; color:#537f71; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; margin-bottom:12px;">Week Ahead</div>
      <table style="width:100%; border-collapse:collapse; border:1px solid #eef4f1; border-radius:6px; overflow:hidden; margin-bottom:24px;">
        <tbody><tr>${weekStrip}</tr></tbody>
      </table>

      <hr style="border:none; border-top:1px solid #eef4f1; margin:0 0 20px;">
      <p style="color:#aaa; font-size:11px; line-height:1.7; margin:0;">
        Your weekly vineyard briefing from Free Run Cellars.
        <a href="https://www.frcwine.com/tools/vineyard-season.html" style="color:#537f71;">Full season dashboard →</a>
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
    const fRes  = await fetch(forecastUrl());
    const fData = await fRes.json();
    const days  = parseForecast(fData);

    // Saturday = index 1, Sunday = index 2 (today is Friday when cron runs)
    const weekendDays = days.slice(1, 3);
    const allDays     = days;

    const frostWarnings = getFrostWarnings(days.slice(0, 7));

    const gddRaw    = await kvGet('frc_current_gdd');
    const currentGDD = gddRaw ? Number(gddRaw) : 0;
    const stageIdx   = getCurrentStageIdx(currentGDD);
    const stageLabel = STAGES[stageIdx].label;

    await sendBrevoEmail({
      subject: `🍇 Weekend Forecast · Free Run Cellars · ${weekendDays.map(d => {
        const dt = new Date(d.date + 'T12:00:00');
        return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }).join(' & ')}`,
      htmlContent: buildWeekendHtml(weekendDays, allDays, currentGDD, stageLabel, frostWarnings),
    });

    console.log('[weekend-forecast-cron] Weekend forecast email sent');
    return res.json({ ok: true, sent: true });

  } catch (err) {
    console.error('[weekend-forecast-cron]', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
