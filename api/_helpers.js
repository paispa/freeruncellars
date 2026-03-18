// api/_helpers.js — Shared CORS and rate-limiting utilities for API handlers

const ALLOWED_ORIGINS = [
  'https://freeruncellars.com',
  'https://www.freeruncellars.com',
  'https://freeruncellars.vercel.app',
];

/**
 * Sets CORS headers when a recognised browser Origin is present, then returns
 * true if the request should proceed or false if it should be rejected.
 *
 * Requests with NO Origin header (curl, Vercel cron, server-to-server) are
 * always allowed through — they are not cross-origin browser requests and do
 * not need CORS enforcement.
 */
function applyCors(req, res) {
  const origin = req.headers.origin || '';
  if (!origin) return true; // non-browser request — no CORS restriction
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    return true;
  }
  return false; // unknown browser origin — reject
}

/**
 * Returns a stateful per-IP rate-limiter function.
 * State is in-memory, so limits are per serverless instance (good enough to
 * block naive abuse; not a distributed quota).
 *
 * @param {number} max       Maximum requests allowed in the window
 * @param {number} windowMs  Window size in milliseconds
 */
function makeRateLimiter(max, windowMs) {
  const map = new Map();
  return function isRateLimited(ip) {
    const now = Date.now();
    const entry = map.get(ip) || { count: 0, windowStart: now };
    if (now - entry.windowStart > windowMs) {
      entry.count = 1;
      entry.windowStart = now;
    } else {
      entry.count += 1;
    }
    map.set(ip, entry);
    return entry.count > max;
  };
}

/** Best-effort client IP from Vercel's forwarded headers. */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

module.exports = { ALLOWED_ORIGINS, applyCors, makeRateLimiter, getClientIp };
