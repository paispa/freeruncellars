// api/frost-alert-cron.js
// Daily vineyard health check — runs at 6:00 AM Central (11:00 UTC every day)
// Required env vars: BREVO_API_KEY, CRON_SECRET, KV_REST_API_URL, KV_REST_API_TOKEN

const {
  fetchForecast, fetchHistoricalGDD, computeSeasonData,
  getCurrentStage, projectStages, fmtDateRange, daysSincePruning,
  evaluateWarnings,
  kvGet, checkDedup, recordDedup,
  buildAlertEmailHtml, sendBrevoEmail,
} = require('./_vineyard');

module.exports = async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  console.log('[frost-alert-cron] Starting daily vineyard check');

  try {
    // 1. Fetch forecast + historical GDD in parallel
    const [forecastDays, historicalData] = await Promise.all([
      fetchForecast(),
      fetchHistoricalGDD(),
    ]);

    // 2. Compute season data
    const { totalGDD, avgRate } = computeSeasonData(historicalData);
    console.log(`[frost-alert-cron] GDD: ${totalGDD.toFixed(1)}, avg rate: ${avgRate.toFixed(2)}/day`);

    // 3. Determine stages + projections
    const { currentStage, nextStage } = getCurrentStage(totalGDD);
    const projections  = projectStages(totalGDD, avgRate);
    const nextProj     = projections[0] || null;
    const nextStageEst = nextProj ? fmtDateRange(nextProj.early, nextProj.late) : null;

    // 4. Read bud break flag from KV
    const budBreakRecorded = (await kvGet('frc_bud_break_recorded')) === 'true';

    // 5. Evaluate all warnings against 10-day forecast
    const allWarnings      = evaluateWarnings(forecastDays, budBreakRecorded, totalGDD);
    const emailableWarnings = allWarnings.filter(w => w.triggerEmail);

    if (emailableWarnings.length === 0) {
      console.log('[frost-alert-cron] No emailable warnings — skipping email');
      return res.status(200).json({ ok: true, message: 'No warnings' });
    }

    // 6. Dedup check
    const warningKeys = emailableWarnings.map(w => w.key);
    if (await checkDedup(warningKeys)) {
      console.log('[frost-alert-cron] Duplicate within 23h — skipping email');
      return res.status(200).json({ ok: true, message: 'Duplicate, skipped' });
    }

    // 7. Build and send alert email
    const subjectBody = emailableWarnings.map(w => w.label.replace(/^⚠️\s*/, '')).join(' · ');
    const subject = `🌿 FRC Vineyard Alert — ${subjectBody}`;

    const html = buildAlertEmailHtml({
      warnings:        emailableWarnings,
      currentGDD:      totalGDD,
      currentStage,
      nextStage,
      nextStageEst,
      forecastDays,
      budBreakRecorded,
      daysSince:       daysSincePruning(),
    });

    await sendBrevoEmail(subject, html);
    await recordDedup(warningKeys);

    console.log('[frost-alert-cron] Alert sent:', subject);
    return res.status(200).json({ ok: true, sent: true, warnings: warningKeys });

  } catch (e) {
    console.error('[frost-alert-cron] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
