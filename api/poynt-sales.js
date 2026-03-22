// api/poynt-sales.js — Fetch Poynt transactions and apply flight allocation logic

const { applyCors, makeRateLimiter, getClientIp } = require('./_helpers');
const { getAccessToken, POYNT_BASE } = require('./poynt-auth');

const POYNT_BUSINESS_ID = process.env.POYNT_BUSINESS_ID;

const isRateLimited = makeRateLimiter(10, 60_000); // 10 req/min

// ─── Flight allocation ──────────────────────────────────────────────────────

const FLIGHTS = {
  'Dry White Flight': ['Dry Riesling', 'Pinot Gris', 'Fusion'],
  'Dry Red Flight':   ['Rosé', 'Lemberger', 'Meritage'],
  'Sweet Flight':     ['Mezzo', 'Valvin Muscat', 'Rosso'],
};

/**
 * Distributes flight sales equally across member wines.
 * Returns a map of wine name → { revenue, glasses, bottles, flightShares }.
 */
function allocateFlights(orders) {
  const wines = {};

  function ensureWine(name) {
    if (!wines[name]) wines[name] = { revenue: 0, glasses: 0, bottles: 0, flightShares: 0 };
    return wines[name];
  }

  for (const order of orders) {
    if (!order.items) continue;
    for (const item of order.items) {
      const name = (item.name || '').trim();
      const qty = item.quantity || 1;
      const amount = (item.unitPrice || 0) * qty / 100; // Poynt amounts in cents

      // Check if this is a flight
      const flightWines = FLIGHTS[name];
      if (flightWines) {
        const share = amount / flightWines.length;
        for (const w of flightWines) {
          const entry = ensureWine(w);
          entry.revenue += share;
          entry.flightShares += qty;
        }
        continue;
      }

      // Regular wine sale — try to classify as glass or bottle
      const lower = name.toLowerCase();
      const entry = ensureWine(name);
      entry.revenue += amount;
      if (lower.includes('glass') || lower.includes('gls')) {
        entry.glasses += qty;
      } else if (lower.includes('bottle') || lower.includes('btl')) {
        entry.bottles += qty;
      } else {
        // Default: count as glass
        entry.glasses += qty;
      }
    }
  }

  return wines;
}

/**
 * Summarises orders into high-level metrics.
 */
function buildSummary(orders, wineMap) {
  let totalRevenue = 0;
  let transactionCount = orders.length;
  for (const order of orders) {
    for (const item of (order.items || [])) {
      totalRevenue += ((item.unitPrice || 0) * (item.quantity || 1)) / 100;
    }
  }

  // Top wine by revenue
  let topWine = '—';
  let topRev = 0;
  for (const [name, data] of Object.entries(wineMap)) {
    if (data.revenue > topRev) { topRev = data.revenue; topWine = name; }
  }

  return { totalRevenue, transactionCount, topWine };
}

/**
 * Builds a daily revenue timeline from orders.
 * Returns array of { date: 'YYYY-MM-DD', revenue: number }.
 */
function buildTimeline(orders) {
  const dayMap = {};
  for (const order of orders) {
    const d = (order.createdAt || '').slice(0, 10); // YYYY-MM-DD
    if (!d) continue;
    if (!dayMap[d]) dayMap[d] = 0;
    for (const item of (order.items || [])) {
      dayMap[d] += ((item.unitPrice || 0) * (item.quantity || 1)) / 100;
    }
  }
  return Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }));
}

// ─── Poynt API fetch with pagination ────────────────────────────────────────

async function fetchOrders(token, startAt, endAt) {
  const orders = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = new URL(`${POYNT_BASE}/businesses/${POYNT_BUSINESS_ID}/orders`);
    url.searchParams.set('startAt', startAt);
    if (endAt) url.searchParams.set('endAt', endAt);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(limit));

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        'api-version': '1.2',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Poynt orders request failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    const items = data.orders || data.items || [];
    orders.push(...items);

    // Stop if we got fewer than limit (last page)
    if (items.length < limit) break;
    offset += limit;
    // Safety cap at 2000 orders
    if (offset >= 2000) break;
  }

  return orders;
}

// ─── HTTP handler ───────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (!applyCors(req, res)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const ip = getClientIp(req);
  if (isRateLimited(ip)) return res.status(429).json({ error: 'rate_limited' });

  const { password, startDate, endDate, inventory } = req.body || {};

  // Auth
  if (!password || password !== process.env.DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (!POYNT_BUSINESS_ID) {
    return res.status(500).json({ error: 'poynt_not_configured' });
  }

  // Default range: last 30 days
  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 30);

  const startAt = startDate
    ? new Date(startDate).toISOString()
    : defaultStart.toISOString();
  const endAt = endDate
    ? new Date(endDate).toISOString()
    : now.toISOString();

  try {
    const token = await getAccessToken();
    const orders = await fetchOrders(token, startAt, endAt);
    const wineMap = allocateFlights(orders);
    const summary = buildSummary(orders, wineMap);
    const timeline = buildTimeline(orders);

    // Inventory calculations (if provided by client)
    let inventoryResult = null;
    if (inventory && typeof inventory === 'object') {
      inventoryResult = {};
      // 12 bottles per case
      for (const [wine, data] of Object.entries(wineMap)) {
        const totalBottlesSold = data.bottles + Math.ceil(data.glasses / 5); // ~5 glasses/bottle
        const startingCases = inventory[wine] ?? null;
        const remaining = startingCases !== null
          ? startingCases - (totalBottlesSold / 12)
          : null;
        inventoryResult[wine] = {
          bottlesSold: data.bottles,
          glassesSold: data.glasses,
          flightShares: data.flightShares,
          estimatedBottlesUsed: totalBottlesSold,
          startingCases: startingCases,
          remainingCases: remaining !== null ? Math.round(remaining * 10) / 10 : null,
          lowStock: remaining !== null && remaining < 1,
        };
      }
    }

    return res.status(200).json({
      ok: true,
      summary,
      wines: wineMap,
      timeline,
      inventory: inventoryResult,
      period: { startAt, endAt },
    });
  } catch (err) {
    console.error('poynt-sales error:', err);
    return res.status(502).json({ error: 'poynt_request_failed', detail: err.message });
  }
};

// Export internals for testing
module.exports.allocateFlights = allocateFlights;
module.exports.buildSummary = buildSummary;
module.exports.buildTimeline = buildTimeline;
module.exports.FLIGHTS = FLIGHTS;
