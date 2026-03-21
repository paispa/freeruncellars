// api/_vineyard.js — Shared vineyard logic for Free Run Cellars
// Used by: frost-alert.js, frost-alert-cron.js, weekend-forecast-cron.js
// No env vars required in this file.

const LAT          = 41.9478;
const LON          = -86.3483;
const SEASON_YEAR  = 2026;
const PRUNING_DATE = '2026-03-17';
const GDD_BASE     = 50; // Fahrenheit base temperature

// ── Phenological stages — Pinot Gris, SW Michigan ──────────────────────────
const STAGES = [
  { key: 'pruning',   label: 'Pruning',   gdd: 0,    icon: '✂️',
    recorded: true, date: '2026-03-17', date2: '2026-03-18' },
  { key: 'bud_swell', label: 'Bud Swell', gdd: 50,   icon: '🌱' },
  { key: 'bud_break', label: 'Bud Break', gdd: 100,  icon: '🌿' },
  { key: 'shoot_3in', label: '3" Shoot',  gdd: 200,  icon: '🌾' },
  { key: 'bloom',     label: 'Bloom',     gdd: 370,  icon: '🌸' },
  { key: 'fruit_set', label: 'Fruit Set', gdd: 500,  icon: '🍇' },
  { key: 'veraison',  label: 'Veraison',  gdd: 1900, icon: '🫐' },
  { key: 'harvest',   label: 'Harvest',   gdd: 2400, icon: '🍷' },
];

// ── Visitor-friendly labels ─────────────────────────────────────────────────
const VISITOR_LABELS = {
  pruning:   'Resting after pruning',
  bud_swell: 'Vines waking up',
  bud_break: 'First buds of the season',
  shoot_3in: 'Young shoots growing',
  bloom:     'Vines in bloom',
  fruit_set: 'Grapes forming',
  veraison:  'Grapes changing color',
  harvest:   'Harvest time',
};

// ── Seasonal quiet notes (public widget, no-warnings state) ─────────────────
const SEASONAL_QUIET = {
  spring: '🌿 Vines resting well',
  summer: '☀️ A beautiful growing season',
  fall:   '🍂 Moving toward harvest',
  winter: '❄️ Vines in winter dormancy',
};

// month: 0-indexed (JS Date.getMonth())
function getSeasonalQuiet(month) {
  if (month >= 2 && month <= 4) return SEASONAL_QUIET.spring; // Mar–May
  if (month >= 5 && month <= 7) return SEASONAL_QUIET.summer; // Jun–Aug
  if (month >= 8 && month <= 10) return SEASONAL_QUIET.fall;  // Sep–Nov
  return SEASONAL_QUIET.winter;                                // Dec–Feb
}

// ── GDD calculation ─────────────────────────────────────────────────────────
// Single-day GDD using simple averaging method
function calcDayGDD(tmax, tmin) {
  return Math.max(0, ((tmax + tmin) / 2) - GDD_BASE);
}

// ── Date prediction ─────────────────────────────────────────────────────────
// gddHistory: array of daily GDD values (most recent last)
// Returns: { mid, early, late, daysUntil, avgRate, isImminent } or null
function predictStageDate(stageGDD, currentGDD, gddHistory) {
  const recent  = gddHistory.slice(-14);
  const avgRate = recent.length > 0
    ? recent.reduce((a, b) => a + b, 0) / recent.length
    : 0;

  if (avgRate < 0.1) return null; // accumulation too slow to predict

  const gddRemaining = stageGDD - currentGDD;
  if (gddRemaining <= 0) return null; // already passed

  const daysUntil   = gddRemaining / avgRate;
  const today       = new Date();
  const midDate     = new Date(today.getTime() + daysUntil * 86400000);
  const isImminent  = gddRemaining <= 50;
  const spread      = avgRate < 0.5 ? 14 : (isImminent ? 3 : 7);
  const early       = new Date(midDate.getTime() - spread * 86400000);
  const late        = new Date(midDate.getTime() + spread * 86400000);

  return { mid: midDate, early, late, daysUntil: Math.round(daysUntil), avgRate, isImminent };
}

// ── Stage helpers ───────────────────────────────────────────────────────────
// Returns index of the last completed stage (GDD ≥ stage threshold)
function getCurrentStageIdx(currentGDD) {
  let idx = 0;
  for (let i = 0; i < STAGES.length; i++) {
    if (currentGDD >= STAGES[i].gdd) idx = i;
    else break;
  }
  return idx;
}

// ── Visitor day scoring ─────────────────────────────────────────────────────
const DAY_SCORES = {
  BEAUTIFUL:   { label: 'Beautiful',   color: '#537f71' },
  NICE:        { label: 'Nice',        color: '#739885' },
  MILD:        { label: 'Mild',        color: '#707271' },
  CHALLENGING: { label: 'Challenging', color: '#fd8d3c' },
};

// weatherCode: WMO code; tempHigh/tempLow in °F; precipPct 0–100
function scoreVisitorDay(tempHigh, tempLow, precipPct, weatherCode) {
  const isSunny        = weatherCode <= 1;
  const isPartlyCloudy = weatherCode <= 3;
  const isRainy        = weatherCode >= 61;

  if (isRainy || tempHigh < 45 || tempHigh > 90 || precipPct > 60)
    return DAY_SCORES.CHALLENGING;
  if (isSunny && tempHigh >= 55 && tempHigh <= 80 && precipPct < 20)
    return DAY_SCORES.BEAUTIFUL;
  if (isPartlyCloudy && tempHigh >= 50 && tempHigh <= 85 && precipPct < 40)
    return DAY_SCORES.NICE;
  return DAY_SCORES.MILD;
}

// ── Date formatting ─────────────────────────────────────────────────────────
function fmtDateShort(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateRange(early, late) {
  const em = early.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const ld = late.getDate();
  if (early.getMonth() === late.getMonth()) return `${em}–${ld}`;
  const lm = late.toLocaleDateString('en-US', { month: 'short' });
  return `${em}–${lm} ${ld}`;
}

// ── Days since pruning ──────────────────────────────────────────────────────
// Day 1 = March 17, 2026
function daysSincePruning() {
  const pruning = new Date('2026-03-17T00:00:00');
  const today   = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((today - pruning) / 86400000) + 1);
}

// ── WMO weather code → emoji ────────────────────────────────────────────────
function weatherEmoji(code) {
  if (code === 0)                return '☀️';
  if (code <= 2)                 return '🌤️';
  if (code === 3)                return '☁️';
  if (code >= 45 && code <= 48)  return '🌫️';
  if (code >= 51 && code <= 57)  return '🌦️';
  if (code >= 61 && code <= 65)  return '🌧️';
  if (code >= 71 && code <= 77)  return '🌨️';
  if (code >= 80 && code <= 82)  return '🌦️';
  if (code >= 85 && code <= 86)  return '🌨️';
  if (code >= 95)                return '⛈️';
  return '🌡️';
}

// ── Short weather descriptor ────────────────────────────────────────────────
function weatherDesc(code) {
  if (code === 0)                return 'Clear';
  if (code <= 2)                 return 'Partly cloudy';
  if (code === 3)                return 'Overcast';
  if (code >= 45 && code <= 48)  return 'Foggy';
  if (code >= 51 && code <= 57)  return 'Drizzle';
  if (code >= 61 && code <= 65)  return 'Rain';
  if (code >= 71 && code <= 77)  return 'Snow';
  if (code >= 80 && code <= 82)  return 'Showers';
  if (code >= 85 && code <= 86)  return 'Snow showers';
  if (code >= 95)                return 'Thunderstorms';
  return 'Mixed';
}

// ── Frost warning detection ─────────────────────────────────────────────────
// forecastDays: [{ date, tmax, tmin, precip, code }, ...]
// Returns array of warning objects
function getFrostWarnings(forecastDays) {
  const warnings = [];
  for (const day of forecastDays) {
    if (day.tmin <= 32) {
      warnings.push({
        type:     'hard_frost',
        label:    'Hard Frost Warning',
        date:     day.date,
        tmin:     day.tmin,
        severity: 'critical',
        msg:      `Low of ${day.tmin}°F expected — hard frost likely. Protect susceptible growth immediately.`,
      });
    } else if (day.tmin <= 36) {
      warnings.push({
        type:     'frost',
        label:    'Frost Watch',
        date:     day.date,
        tmin:     day.tmin,
        severity: 'warning',
        msg:      `Low of ${day.tmin}°F — light frost possible. Monitor conditions closely.`,
      });
    }
  }
  return warnings;
}

// ── Brevo email sender (used by cron and alert endpoints) ──────────────────
// Requires process.env.BREVO_API_KEY
const ALERT_EMAILS = ['prashanth@frcwine.com', 'contact@frcwine.com'];

async function sendBrevoEmail({ subject, htmlContent }) {
  if (!process.env.BREVO_API_KEY) throw new Error('BREVO_API_KEY not set');
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY },
    body: JSON.stringify({
      sender:      { name: 'Free Run Cellars', email: 'contact@frcwine.com' },
      to:          ALERT_EMAILS.map(e => ({ email: e })),
      subject,
      htmlContent,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Vercel KV / Upstash Redis helpers with graceful fallback ─────────────────
// Supports both Vercel KV env var names (KV_REST_API_*) and
// Upstash direct env var names (UPSTASH_REDIS_REST_*).
// If neither is set, KV features are silently skipped.
function kvConfig() {
  // Check all known env var name patterns in priority order:
  //   1. Vercel KV (legacy)           KV_REST_API_URL / KV_REST_API_TOKEN
  //   2. Upstash via Vercel Storage    UPSTASH_REDIS_KV_REST_API_URL / _TOKEN
  //   3. Upstash direct                UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
  const url =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;
  return (url && token) ? { url, token } : null;
}

async function kvGet(key) {
  try {
    const cfg = kvConfig();
    if (!cfg) return null;
    const res  = await fetch(`${cfg.url}/get/${key}`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
    });
    const data = await res.json();
    return data.result ?? null;
  } catch (e) {
    console.warn('[_vineyard] KV get failed:', e.message);
    return null;
  }
}

async function kvSet(key, value) {
  try {
    const cfg = kvConfig();
    if (!cfg) {
      console.warn('[_vineyard] KV not configured — skipping kvSet');
      return;
    }
    await fetch(
      `${cfg.url}/set/${key}/${encodeURIComponent(String(value))}`,
      { method: 'POST', headers: { Authorization: `Bearer ${cfg.token}` } },
    );
  } catch (e) {
    console.warn('[_vineyard] KV set failed:', e.message);
  }
}

// ── Open-Meteo URL builders ─────────────────────────────────────────────────
function forecastUrl() {
  return (
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${LAT}&longitude=${LON}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode,shortwave_radiation_sum` +
    `&temperature_unit=fahrenheit&timezone=America%2FChicago&forecast_days=10`
  );
}

function historicalUrl(startDate, endDate) {
  return (
    `https://archive-api.open-meteo.com/v1/archive` +
    `?latitude=${LAT}&longitude=${LON}` +
    `&start_date=${startDate}&end_date=${endDate}` +
    `&daily=temperature_2m_max,temperature_2m_min` +
    `&temperature_unit=fahrenheit&timezone=America%2FChicago`
  );
}

// Parse raw Open-Meteo forecast response into day objects
function parseForecast(data) {
  return data.daily.time.map((date, i) => ({
    date,
    tmax:   data.daily.temperature_2m_max[i],
    tmin:   data.daily.temperature_2m_min[i],
    precip: data.daily.precipitation_probability_max[i],
    code:   data.daily.weathercode[i],
  }));
}

module.exports = {
  LAT, LON, SEASON_YEAR, PRUNING_DATE, GDD_BASE,
  STAGES, VISITOR_LABELS, SEASONAL_QUIET, ALERT_EMAILS,
  getSeasonalQuiet,
  calcDayGDD,
  predictStageDate,
  getCurrentStageIdx,
  scoreVisitorDay, DAY_SCORES,
  fmtDateShort, fmtDateRange,
  daysSincePruning,
  weatherEmoji, weatherDesc,
  getFrostWarnings,
  sendBrevoEmail,
  kvGet, kvSet,
  forecastUrl, historicalUrl, parseForecast,
};
