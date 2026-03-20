// api/weekend-forecast-cron.js
// Friday weekend forecast email — runs at 10:00 AM Central (15:00 UTC every Friday)
// Required env vars: BREVO_API_KEY, CRON_SECRET, KV_REST_API_URL, KV_REST_API_TOKEN

const {
  fetchForecast, fetchHistoricalGDD, computeSeasonData,
  getCurrentStage, projectStages, fmtDateRange, daysSincePruning,
  evaluateWarnings,
  kvGet, sendBrevoEmail,
  wmoInfo, scoreDay, SCORE_COLOR, MONTHS_SHORT,
} = require('./_vineyard');

// ── Weekend email builder ──────────────────────────────────────────────────────

function dayColumn(day, score) {
  if (!day) return '<td style="padding:16px;text-align:center;border-right:1px solid #f0ede8;">—</td>';
  const [icon, desc] = wmoInfo(day.weathercode);
  const dt = new Date(day.date + 'T12:00:00');
  const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()];
  const dateStr = MONTHS_SHORT[dt.getMonth()] + ' ' + dt.getDate();
  const color = SCORE_COLOR[score] || '#707271';
  return `<td style="padding:16px;text-align:center;border-right:1px solid #f0ede8;vertical-align:top;">
    <div style="font-weight:700;font-size:13px;color:#222;margin-bottom:2px;">${dayName}</div>
    <div style="font-size:11px;color:#999;margin-bottom:10px;">${dateStr}</div>
    <div style="font-size:32px;margin-bottom:8px;line-height:1;">${icon}</div>
    <div style="font-size:13px;color:#c0392b;font-weight:600;">${Math.round(day.tmax)}°</div>
    <div style="font-size:12px;color:#2980b9;margin-bottom:6px;">${Math.round(day.tmin)}°</div>
    <div style="font-size:11px;color:#777;margin-bottom:10px;">${day.precipProb}% precip</div>
    <div style="background:${color};color:#fff;border-radius:20px;padding:4px 10px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;display:inline-block;">${score}</div>
  </td>`;
}

function buildWeekendEmailHtml({ satDay, sunDay, monDay, satScore, sunScore, monScore,
    verdict, currentGDD, currentStage, nextStage, nextStageEst, daysSince, warnings, forecastDays }) {

  const warningBadges = warnings.length
    ? warnings.map(w =>
        `<span style="background:${w.color}22;border:1px solid ${w.color};color:${w.color};border-radius:4px;`
        + `padding:4px 10px;font-size:11px;font-weight:700;margin-right:6px;display:inline-block;margin-bottom:6px;">`
        + `${w.icon} ${w.label}</span>`).join('')
    : '<div style="color:#537f71;font-size:13px;">🌿 No active vineyard concerns this weekend</div>';

  const lookAheadRows = forecastDays.slice(3).map(d => {
    const [icon, desc] = wmoInfo(d.weathercode);
    const hasWarn = warnings.some(w => w.affectedDays && w.affectedDays.find(ad => ad.date === d.date));
    const dt = new Date(d.date + 'T12:00:00');
    return `<tr style="background:${hasWarn ? '#fff8f0' : 'transparent'};">
      <td style="padding:7px 10px;font-size:12px;border-bottom:1px solid #f0ede8;">${MONTHS_SHORT[dt.getMonth()]} ${dt.getDate()}</td>
      <td style="padding:7px 10px;font-size:13px;border-bottom:1px solid #f0ede8;">${icon}</td>
      <td style="padding:7px 10px;font-size:12px;color:#c0392b;font-weight:600;border-bottom:1px solid #f0ede8;">${Math.round(d.tmax)}°</td>
      <td style="padding:7px 10px;font-size:12px;color:#2980b9;border-bottom:1px solid #f0ede8;">${Math.round(d.tmin)}°</td>
      <td style="padding:7px 10px;font-size:12px;border-bottom:1px solid #f0ede8;">${desc}</td>
      <td style="padding:7px 10px;font-size:12px;color:#555;border-bottom:1px solid #f0ede8;">${d.precipProb}%</td>
    </tr>`;
  }).join('');

  const nextMilestoneRow = nextStage
    ? `<tr style="background:#f3f0ec;"><td style="padding:10px 14px;color:#777;">Next Milestone</td><td style="padding:10px 14px;color:#222;">${nextStage.icon} ${nextStage.label}</td></tr>`
    : '';
  const estRow = nextStageEst
    ? `<tr><td style="padding:10px 14px;color:#777;">Est. Date Range</td><td style="padding:10px 14px;color:#537f71;font-weight:600;">${nextStageEst}</td></tr>`
    : '';

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Georgia,serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:#537f71;padding:24px 32px;text-align:center;">
    <div style="color:#fff;font-size:11px;letter-spacing:3px;text-transform:uppercase;opacity:.75;margin-bottom:4px;">Free Run Cellars</div>
    <div style="color:#fff;font-size:20px;font-weight:300;letter-spacing:1px;">Weekend Briefing</div>
    <div style="color:rgba(255,255,255,.75);font-size:13px;margin-top:6px;font-style:italic;">${verdict}</div>
  </div>
  <div style="padding:28px 32px;">
    <h2 style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#537f71;margin-bottom:16px;">Weekend at a Glance</h2>
    <table style="width:100%;border-collapse:collapse;background:#fafaf9;border:1px solid #f0ede8;">
      <tr>
        ${dayColumn(satDay, satScore)}
        ${dayColumn(sunDay, sunScore)}
        ${dayColumn(monDay, monScore)}
      </tr>
    </table>

    <h2 style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#537f71;margin:28px 0 16px;">Vineyard This Week</h2>
    <table style="width:100%;font-size:13px;border-collapse:collapse;background:#f9f7f4;">
      <tr><td style="padding:10px 14px;color:#777;width:160px;">Growing Degree Days</td><td style="padding:10px 14px;font-weight:600;color:#222;">${currentGDD.toFixed(1)} GDD</td></tr>
      <tr style="background:#f3f0ec;"><td style="padding:10px 14px;color:#777;">Current Stage</td><td style="padding:10px 14px;color:#222;">${currentStage ? currentStage.icon + ' ' + currentStage.label : '—'}</td></tr>
      <tr><td style="padding:10px 14px;color:#777;">Days Since Pruning</td><td style="padding:10px 14px;color:#222;">Day ${daysSince}</td></tr>
      ${nextMilestoneRow}${estRow}
    </table>
    <div style="margin-top:14px;">${warningBadges}</div>

    ${lookAheadRows ? `
    <h2 style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#537f71;margin:28px 0 16px;">Looking Ahead</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr style="background:#f0ede8;">
        <th style="padding:7px 10px;font-size:10px;text-align:left;color:#777;font-weight:600;letter-spacing:1px;">Date</th>
        <th style="padding:7px 10px;"></th>
        <th style="padding:7px 10px;font-size:10px;text-align:left;color:#777;font-weight:600;letter-spacing:1px;">High</th>
        <th style="padding:7px 10px;font-size:10px;text-align:left;color:#777;font-weight:600;letter-spacing:1px;">Low</th>
        <th style="padding:7px 10px;font-size:10px;text-align:left;color:#777;font-weight:600;letter-spacing:1px;">Conditions</th>
        <th style="padding:7px 10px;font-size:10px;text-align:left;color:#777;font-weight:600;letter-spacing:1px;">Precip%</th>
      </tr>
      ${lookAheadRows}
    </table>` : ''}
  </div>
  <div style="background:#f0ede8;padding:20px 32px;text-align:center;">
    <p style="font-size:11px;color:#888;margin:0 0 4px;">Free Run Cellars · 10062 Burgoyne Rd, Berrien Springs MI 49103</p>
    <p style="font-size:11px;color:#888;margin:0 0 4px;">Sent every Friday at 10 AM Central.</p>
    <p style="font-size:11px;color:#aaa;margin:0;">Staff tool: freeruncellars.com/tools/vineyard-season</p>
  </div>
</div></body></html>`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  console.log('[weekend-forecast-cron] Starting Friday briefing');

  try {
    const [forecastDays, historicalData] = await Promise.all([
      fetchForecast(),
      fetchHistoricalGDD(),
    ]);

    const { totalGDD, avgRate } = computeSeasonData(historicalData);
    const { currentStage, nextStage } = getCurrentStage(totalGDD);
    const projections  = projectStages(totalGDD, avgRate);
    const nextProj     = projections[0] || null;
    const nextStageEst = nextProj ? fmtDateRange(nextProj.early, nextProj.late) : null;
    const budBreakRecorded = (await kvGet('frc_bud_break_recorded')) === 'true';
    const daysSince = daysSincePruning();

    // index 0 = today (Friday), 1 = Saturday, 2 = Sunday, 3 = Monday
    const satDay = forecastDays[1] || null;
    const sunDay = forecastDays[2] || null;
    const monDay = forecastDays[3] || null;

    const satScore = satDay ? scoreDay(satDay) : null;
    const sunScore = sunDay ? scoreDay(sunDay) : null;
    const monScore = monDay ? scoreDay(monDay) : null;

    // Warnings evaluated against weekend days only
    const weekendDays = [satDay, sunDay, monDay].filter(Boolean);
    const warnings = evaluateWarnings(weekendDays, budBreakRecorded, totalGDD);

    // Generate verdict
    const scores    = [satScore, sunScore, monScore].filter(Boolean);
    const goodDays  = scores.filter(s => s === 'Beautiful' || s === 'Nice').length;
    const bestIdx   = scores.findIndex(s => s === 'Beautiful') !== -1
                        ? scores.findIndex(s => s === 'Beautiful')
                        : scores.findIndex(s => s === 'Nice');
    const dayNames  = ['Saturday', 'Sunday', 'Monday'];
    const bestDay   = bestIdx >= 0 ? dayNames[bestIdx] : 'the weekend';
    let verdict;
    if (goodDays >= 3)       verdict = 'A stunning weekend ahead';
    else if (goodDays === 2) verdict = `A great weekend — ${bestDay} looks best for visiting`;
    else if (goodDays === 1) verdict = `A mixed weekend — ${bestDay} looks best`;
    else                     verdict = 'A quiet weekend — cozy indoor tastings await';

    const satDt = satDay ? new Date(satDay.date + 'T12:00:00') : null;
    const subjectDate = satDt ? `Sat ${MONTHS_SHORT[satDt.getMonth()]} ${satDt.getDate()}` : 'This Weekend';
    const subject = `🍷 FRC Weekend Forecast — ${subjectDate} · ${verdict}`;

    const html = buildWeekendEmailHtml({
      satDay, sunDay, monDay, satScore, sunScore, monScore, verdict,
      currentGDD: totalGDD, currentStage, nextStage, nextStageEst, daysSince,
      warnings, forecastDays,
    });

    await sendBrevoEmail(subject, html);
    console.log('[weekend-forecast-cron] Sent:', subject);
    return res.status(200).json({ ok: true, sent: true, verdict });

  } catch (e) {
    console.error('[weekend-forecast-cron] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
