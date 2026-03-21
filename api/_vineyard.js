// api/_vineyard.js — Shared vineyard logic for cron + alert handlers
// Required env vars: BREVO_API_KEY, KV_REST_API_URL (or UPSTASH_REDIS_KV_REST_API_URL), KV_REST_API_TOKEN (or UPSTASH_REDIS_KV_REST_API_TOKEN)

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGES = [
  { key: 'pruning',   label: 'Pruning',    gdd: 0,    icon: '✂️',  recorded: true, date: '2026-03-17', date2: '2026-03-18' },
  { key: 'bud_swell', label: 'Bud Swell',  gdd: 50,   icon: '🌱' },
  { key: 'bud_break', label: 'Bud Break',  gdd: 100,  icon: '🌿' },
  { key: 'shoot_3in', label: '3" Shoot',   gdd: 200,  icon: '🌾' },
  { key: 'bloom',     label: 'Bloom',      gdd: 370,  icon: '🌸' },
  { key: 'fruit_set', label: 'Fruit Set',  gdd: 500,  icon: '🍇' },
  { key: 'veraison',  label: 'Veraison',   gdd: 1900, icon: '🫐' },
  { key: 'harvest',   label: 'Harvest',    gdd: 2400, icon: '🍷' },
];

const WMO_CODES = {
  0:  ['☀️',  'Clear'],          1:  ['🌤️', 'Mainly Clear'],
  2:  ['⛅',  'Partly Cloudy'],  3:  ['☁️',  'Overcast'],
  45: ['🌫️', 'Foggy'],          48: ['🌫️', 'Freezing Fog'],
  51: ['🌦️', 'Light Drizzle'],  53: ['🌦️', 'Drizzle'],         55: ['🌦️', 'Heavy Drizzle'],
  61: ['🌧️', 'Light Rain'],     63: ['🌧️', 'Rain'],             65: ['🌧️', 'Heavy Rain'],
  71: ['🌨️', 'Light Snow'],     73: ['🌨️', 'Snow'],             75: ['🌨️', 'Heavy Snow'],
  77: ['🌨️', 'Snow Grains'],    80: ['🌦️', 'Showers'],         81: ['🌦️', 'Showers'],
  82: ['⛈️',  'Heavy Showers'], 85: ['🌨️', 'Snow Showers'],    86: ['🌨️', 'Heavy Snow'],
  95: ['⛈️',  'Thunderstorm'],  96: ['⛈️',  'Thunderstorm'],   99: ['⛈️',  'Thunderstorm'],
};

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Visitor-friendly stage labels (used by public about-page widget) ──────────
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

// ── Seasonal quiet notes (public widget, no-warnings state) ──────────────────
const SEASONAL_QUIET = {
  spring: '🌿 Vines resting well',
  summer: '☀️ A beautiful growing season',
  fall:   '🍂 Moving toward harvest',
  winter: '❄️ Vines in winter dormancy',
};

// month: 0-indexed JS Date.getMonth()
function getSeasonalQuiet(month) {
  if (month >= 2 && month <= 4) return SEASONAL_QUIET.spring; // Mar–May
  if (month >= 5 && month <= 7) return SEASONAL_QUIET.summer; // Jun–Aug
  if (month >= 8 && month <= 10) return SEASONAL_QUIET.fall;  // Sep–Nov
  return SEASONAL_QUIET.winter;
}

const SCORE_COLOR = {
  Beautiful: '#537f71',
  Nice:      '#739885',
  Mild:      '#707271',
  Challenging: '#fd8d3c',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function wmoInfo(code) {
  return WMO_CODES[code] || ['🌡️', 'Variable'];
}

function calcGDD(tmax, tmin) {
  return Math.max(0, (tmax + tmin) / 2 - 50);
}

function fmtDateRange(early, late) {
  if (early.getMonth() === late.getMonth()) {
    return `~${MONTHS_SHORT[early.getMonth()]} ${early.getDate()}–${late.getDate()}`;
  }
  return `~${MONTHS_SHORT[early.getMonth()]} ${early.getDate()} – ${MONTHS_SHORT[late.getMonth()]} ${late.getDate()}`;
}

function daysSincePruning(today = new Date()) {
  const pruning = new Date('2026-03-17T00:00:00');
  const diff = Math.floor((today - pruning) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diff);
}

function scoreDay(day) {
  const { tmax, precipProb, weathercode } = day;
  if (weathercode <= 2 && tmax >= 55 && tmax <= 80 && precipProb < 20) return 'Beautiful';
  if (weathercode <= 3 && tmax >= 50 && tmax <= 85 && precipProb < 40) return 'Nice';
  if (precipProb > 60 || tmax < 45 || tmax > 90) return 'Challenging';
  return 'Mild';
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchForecast() {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=41.9478&longitude=-86.3411'
    + '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode,shortwave_radiation_sum'
    + '&temperature_unit=fahrenheit&timezone=America%2FChicago&forecast_days=10';
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('Forecast fetch failed: ' + res.status);
  const data = await res.json();
  const { time, temperature_2m_max: tmaxArr, temperature_2m_min: tminArr,
          precipitation_probability_max: precipArr, weathercode: codeArr } = data.daily;
  return time.map((date, i) => ({
    date,
    tmax: tmaxArr[i],
    tmin: tminArr[i],
    precipProb: precipArr[i] || 0,
    weathercode: codeArr[i],
  }));
}

async function fetchHistoricalGDD() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const endDate = yesterday.toISOString().split('T')[0];
  const url = 'https://archive-api.open-meteo.com/v1/archive'
    + '?latitude=41.9478&longitude=-86.3411'
    + `&start_date=2026-01-01&end_date=${endDate}`
    + '&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America%2FChicago';
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error('Historical fetch failed: ' + res.status);
  return res.json();
}

// ── Season computation ────────────────────────────────────────────────────────

function computeSeasonData(historicalData) {
  const { time, temperature_2m_max: tmaxArr, temperature_2m_min: tminArr } = historicalData.daily;
  let totalGDD = 0;
  const dailyGDD = [];
  for (let i = 0; i < time.length; i++) {
    const gdd = calcGDD(tmaxArr[i] || 0, tminArr[i] || 0);
    totalGDD += gdd;
    dailyGDD.push({ date: time[i], gdd, cumulative: totalGDD });
  }
  const last14 = dailyGDD.slice(-14);
  const avgRate = last14.length > 0
    ? last14.reduce((s, d) => s + d.gdd, 0) / last14.length
    : 0;
  return { totalGDD, dailyGDD, avgRate };
}

function getCurrentStage(gdd) {
  let idx = 0;
  for (let i = 0; i < STAGES.length - 1; i++) {
    if (gdd >= STAGES[i].gdd) idx = i;
    else break;
  }
  if (gdd >= STAGES[STAGES.length - 1].gdd) idx = STAGES.length - 1;
  return {
    currentStage: STAGES[idx],
    nextStage: idx < STAGES.length - 1 ? STAGES[idx + 1] : null,
  };
}

function projectStages(currentGDD, avgRate) {
  const today = new Date();
  return STAGES
    .filter(s => s.gdd > currentGDD)
    .map(stage => {
      const gddRemaining = stage.gdd - currentGDD;
      const rate = Math.max(avgRate, 0.1);
      const daysUntil = Math.round(gddRemaining / rate);
      const projected = new Date(today);
      projected.setDate(projected.getDate() + daysUntil);
      let spread = avgRate < 0.5 ? 14 : 7;
      if (gddRemaining < 50) spread = 3;
      const early = new Date(projected); early.setDate(early.getDate() - spread);
      const late  = new Date(projected); late.setDate(late.getDate()  + spread);
      return { stage, gddRemaining, daysUntil, projected, early, late, imminent: gddRemaining < 50 };
    });
}

// ── Warning evaluation ────────────────────────────────────────────────────────

function evaluateWarnings(forecastDays, budBreakRecorded, currentGDD) {
  const results = [];
  const inBloomWindow = currentGDD >= 320 && currentGDD <= 520;

  let heatStreak = 0;
  for (const d of forecastDays) { if (d.tmax > 90) heatStreak++; else break; }

  let dryDays = 0;
  for (const d of forecastDays) { if (d.precipProb < 20) dryDays++; else break; }

  const frostDays = forecastDays.filter(d => d.tmin <= 32);
  if (frostDays.length > 0) {
    if (budBreakRecorded) {
      results.push({ key: 'frost_post_budbreak', label: '⚠️ FROST DANGER — Bud Break Active',
        icon: '🚨', color: '#e05c5c', urgent: true, triggerEmail: true, affectedDays: frostDays });
    } else {
      results.push({ key: 'frost_pre_budbreak', label: 'Frost Risk',
        icon: '❄️', color: '#6baed6', urgent: false, triggerEmail: true, affectedDays: frostDays });
    }
  }

  if (heatStreak >= 3) {
    results.push({ key: 'heat_stress', label: 'Heat Stress Risk',
      icon: '🌡️', color: '#fd8d3c', urgent: false, triggerEmail: false,
      affectedDays: forecastDays.filter(d => d.tmax > 90) });
  }

  if (inBloomWindow) {
    const bloomRainDays = forecastDays.filter(d => d.precipProb >= 60);
    if (bloomRainDays.length > 0) {
      results.push({ key: 'bloom_rain', label: 'Rain During Bloom Window',
        icon: '🌧️', color: '#fd8d3c', urgent: false, triggerEmail: true, affectedDays: bloomRainDays });
    }
  }

  if (dryDays >= 14) {
    results.push({ key: 'drought', label: 'Drought Stress Risk',
      icon: '☀️', color: '#fd8d3c', urgent: false, triggerEmail: false, affectedDays: [] });
  }

  return results;
}

// ── Vercel KV REST API ────────────────────────────────────────────────────────

// Resolves env var names for both Vercel KV (legacy) and Upstash via Vercel Storage
function kvCreds() {
  return {
    url:   process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
  };
}

async function kvGet(key) {
  const { url, token } = kvCreds();
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result ?? null;
  } catch { return null; }
}

async function kvSet(key, value) {
  const { url, token } = kvCreds();
  if (!url || !token) return false;
  try {
    const strVal = typeof value === 'string' ? value : JSON.stringify(value);
    const res = await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(strVal)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch { return false; }
}

// ── Deduplication ─────────────────────────────────────────────────────────────

async function checkDedup(warningKeys) {
  const raw = await kvGet('frost_alert_last_sent');
  if (!raw) return false;
  try {
    const rec = JSON.parse(raw);
    const sentKeys    = Array.isArray(rec.warningKeys) ? [...rec.warningKeys].sort().join(',') : '';
    const currentKeys = [...warningKeys].sort().join(',');
    if (sentKeys !== currentKeys) return false;
    return (Date.now() - new Date(rec.sentAt).getTime()) < 23 * 60 * 60 * 1000;
  } catch { return false; }
}

async function recordDedup(warningKeys) {
  await kvSet('frost_alert_last_sent', JSON.stringify({ warningKeys, sentAt: new Date().toISOString() }));
}

// ── Email building ────────────────────────────────────────────────────────────

function warningContextNote(warning, { budBreakRecorded, nextStageEst }) {
  switch (warning.key) {
    case 'frost_pre_budbreak':
      return `Vines are still dormant and hardy. Monitor closely as bud break approaches${nextStageEst ? ' around ' + nextStageEst : ''}.`;
    case 'frost_post_budbreak':
      return '⚠️ Bud break is active. Young shoots are vulnerable below 32°F. Consider frost protection measures immediately.';
    case 'bloom_rain':
      return 'Rain during bloom can reduce fruit set and increase disease pressure. Monitor canopy and consider fungicide timing.';
    case 'heat_stress':
      return 'Extended heat above 90°F can stress vines and reduce fruit quality. Ensure adequate moisture and monitor vine health.';
    case 'drought':
      return 'Extended dry conditions increase vine stress. Consider irrigation if available and monitor soil moisture.';
    default: return '';
  }
}

function buildAlertEmailHtml({ warnings, currentGDD, currentStage, nextStage, nextStageEst, forecastDays, budBreakRecorded, daysSince }) {
  const warningRows = warnings.map(w => {
    const context = warningContextNote(w, { budBreakRecorded, nextStageEst });
    const datesStr = w.affectedDays && w.affectedDays.length
      ? w.affectedDays.map(d => { const dt = new Date(d.date + 'T12:00:00'); return MONTHS_SHORT[dt.getMonth()] + ' ' + dt.getDate(); }).join(', ')
      : '';
    return `<div style="border-left:4px solid ${w.color};padding:14px 16px;background:${w.color}18;margin-bottom:12px;border-radius:0 8px 8px 0;">
      <div style="font-weight:700;font-size:15px;margin-bottom:6px;">${w.icon} ${w.label}</div>
      ${datesStr ? `<div style="font-size:12px;color:#555;margin-bottom:6px;">Affected dates: ${datesStr}</div>` : ''}
      ${context ? `<div style="font-size:13px;color:#333;">${context}</div>` : ''}
    </div>`;
  }).join('');

  const forecastRows = forecastDays.map(d => {
    const [icon, desc] = wmoInfo(d.weathercode);
    const hasWarn = warnings.some(w => w.affectedDays && w.affectedDays.find(ad => ad.date === d.date));
    const dt = new Date(d.date + 'T12:00:00');
    return `<tr style="background:${hasWarn ? '#fff8f0' : '#fff'};">
      <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;font-size:12px;">${MONTHS_SHORT[dt.getMonth()]} ${dt.getDate()}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;font-size:14px;">${icon}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;font-size:12px;color:#c0392b;font-weight:600;">${Math.round(d.tmax)}°F</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;font-size:12px;color:#2980b9;">${Math.round(d.tmin)}°F</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;font-size:12px;">${desc}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f0ede8;font-size:12px;color:#555;">${d.precipProb}%</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Georgia,serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:#537f71;padding:24px 32px;text-align:center;">
    <div style="color:#fff;font-size:11px;letter-spacing:3px;text-transform:uppercase;opacity:.75;margin-bottom:4px;">Free Run Cellars</div>
    <div style="color:#fff;font-size:20px;font-weight:300;letter-spacing:1px;">Vineyard Monitor</div>
  </div>
  <div style="padding:28px 32px;">
    <h2 style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#537f71;margin-bottom:16px;">Active Warnings</h2>
    ${warningRows}
    <h2 style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#537f71;margin:24px 0 16px;">Season Status</h2>
    <table style="width:100%;font-size:13px;border-collapse:collapse;background:#f9f7f4;">
      <tr><td style="padding:10px 14px;color:#777;width:160px;">Growing Degree Days</td><td style="padding:10px 14px;font-weight:600;color:#222;">${currentGDD.toFixed(1)} GDD</td></tr>
      <tr style="background:#f3f0ec;"><td style="padding:10px 14px;color:#777;">Current Stage</td><td style="padding:10px 14px;color:#222;">${currentStage ? currentStage.icon + ' ' + currentStage.label : '—'}</td></tr>
      <tr><td style="padding:10px 14px;color:#777;">Days Since Pruning</td><td style="padding:10px 14px;color:#222;">Day ${daysSince}</td></tr>
      ${nextStage ? `<tr style="background:#f3f0ec;"><td style="padding:10px 14px;color:#777;">Next Milestone</td><td style="padding:10px 14px;color:#222;">${nextStage.icon} ${nextStage.label}</td></tr>` : ''}
      ${nextStageEst ? `<tr><td style="padding:10px 14px;color:#777;">Est. Date Range</td><td style="padding:10px 14px;color:#537f71;font-weight:600;">${nextStageEst}</td></tr>` : ''}
    </table>
    <h2 style="font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#537f71;margin:24px 0 16px;">10-Day Forecast</h2>
    <table style="width:100%;border-collapse:collapse;">
      <tr style="background:#f0ede8;">
        <th style="padding:8px 10px;font-size:10px;text-align:left;color:#777;font-weight:600;letter-spacing:1px;">Date</th>
        <th style="padding:8px 10px;font-size:10px;"></th>
        <th style="padding:8px 10px;font-size:10px;text-align:left;color:#777;font-weight:600;letter-spacing:1px;">High</th>
        <th style="padding:8px 10px;font-size:10px;text-align:left;color:#777;font-weight:600;letter-spacing:1px;">Low</th>
        <th style="padding:8px 10px;font-size:10px;text-align:left;color:#777;font-weight:600;letter-spacing:1px;">Conditions</th>
        <th style="padding:8px 10px;font-size:10px;text-align:left;color:#777;font-weight:600;letter-spacing:1px;">Precip%</th>
      </tr>
      ${forecastRows}
    </table>
  </div>
  <div style="background:#f0ede8;padding:20px 32px;text-align:center;">
    <p style="font-size:11px;color:#888;margin:0 0 4px;">Free Run Cellars · 10062 Burgoyne Rd, Berrien Springs MI 49103</p>
    <p style="font-size:11px;color:#888;margin:0 0 4px;">Daily alerts run at 6 AM Central.</p>
    <p style="font-size:11px;color:#aaa;margin:0;">Staff tool: freeruncellars.com/tools/vineyard-season</p>
  </div>
</div></body></html>`;
}

async function sendBrevoEmail(subject, htmlContent) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error('Missing BREVO_API_KEY');
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify({
      sender: { name: 'FRC Vineyard Monitor', email: 'contact@frcwine.com' },
      to: [
        { email: 'prashanth@frcwine.com', name: 'Prashanth' },
        { email: 'contact@frcwine.com',   name: 'Free Run Cellars' },
      ],
      subject,
      htmlContent,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo send failed: ${res.status} ${text}`);
  }
  return true;
}

module.exports = {
  STAGES, WMO_CODES, MONTHS_SHORT, SCORE_COLOR,
  VISITOR_LABELS, SEASONAL_QUIET,
  wmoInfo, calcGDD, fmtDateRange, daysSincePruning, scoreDay,
  getSeasonalQuiet,
  fetchForecast, fetchHistoricalGDD,
  computeSeasonData, getCurrentStage, projectStages,
  evaluateWarnings,
  kvGet, kvSet, checkDedup, recordDedup,
  warningContextNote, buildAlertEmailHtml, sendBrevoEmail,
};
