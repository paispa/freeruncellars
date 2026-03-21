// api/_helpers.js — Shared utilities for API handlers

// ─── CORS ─────────────────────────────────────────────────────────────────────

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

// ─── Rate limiting ─────────────────────────────────────────────────────────────

/**
 * Returns a stateful per-IP rate-limiter function.
 * State is in-memory per serverless instance — sufficient to block naive abuse.
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

// ─── HTML escaping (used by circle-signup email builder) ──────────────────────

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Upload validation (used by upload-photo) ─────────────────────────────────

const DATA_URI_RE      = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES  = 5 * 1024 * 1024; // 5 MB decoded

// ─── Owners Circle data (used by circle-signup) ───────────────────────────────

const INTERESTS_MAP = {
  ramato:  { id: 1, label: 'First access to new wines' },
  credits: { id: 2, label: '$150 credits + ongoing discount' },
  events:  { id: 3, label: 'Private tastings & owner-only events' },
  tickets: { id: 4, label: 'Early access to live music tickets' },
  updates: { id: 5, label: 'Behind-the-scenes vineyard updates' },
};

/** Normalises a US phone number to E.164 (+1XXXXXXXXXX), or returns undefined. */
function normalizePhone(phone) {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return undefined;
}

module.exports = {
  // CORS
  ALLOWED_ORIGINS, applyCors,
  // Rate limiting
  makeRateLimiter, getClientIp,
  // Email
  escapeHtml,
  // Upload
  DATA_URI_RE, ALLOWED_MIME_TYPES, MAX_IMAGE_BYTES,
  // Circle signup
  INTERESTS_MAP, normalizePhone,
};
