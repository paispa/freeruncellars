// api/poynt-auth.js — Poynt token management with JWT signing and caching

const crypto = require('crypto');
const { applyCors, makeRateLimiter, getClientIp } = require('./_helpers');

const POYNT_APP_ID = process.env.POYNT_APP_ID;
const POYNT_PRIVATE_KEY = process.env.POYNT_PRIVATE_KEY; // PEM-encoded RSA private key (newlines as \n)
const POYNT_BASE = 'https://services.poynt.net';

// ─── In-memory token cache ──────────────────────────────────────────────────

let cachedToken = null;
let tokenExpiresAt = 0;

// ─── Rate limiting ──────────────────────────────────────────────────────────

const isRateLimited = makeRateLimiter(10, 60_000); // 10 req/min

// ─── JWT helpers ────────────────────────────────────────────────────────────

function base64url(buf) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function buildSelfSignedJwt() {
  const now = Math.floor(Date.now() / 1000);
  // Poynt expects iss/sub as URN: urn:aid:<app-uuid>
  const appUrn = POYNT_APP_ID.startsWith('urn:aid:')
    ? POYNT_APP_ID
    : 'urn:aid:' + POYNT_APP_ID;

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    sub: appUrn,
    iss: appUrn,
    jti: crypto.randomUUID(),
    exp: now + 300,
    iat: now,
    aud: POYNT_BASE,
  };

  const segments = [
    base64url(Buffer.from(JSON.stringify(header))),
    base64url(Buffer.from(JSON.stringify(payload))),
  ];

  // Replace literal \n in env var with actual newlines
  const key = POYNT_PRIVATE_KEY.replace(/\\n/g, '\n');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(segments.join('.'));
  const signature = base64url(sign.sign(key));

  return segments.concat(signature).join('.');
}

// ─── Token exchange ─────────────────────────────────────────────────────────

async function getAccessToken() {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const jwt = buildSelfSignedJwt();
  const body = new URLSearchParams({
    grantType: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  });

  const res = await fetch(`${POYNT_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'api-version': '1.2',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Poynt token request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = data.accessToken;
  // expiresIn is in seconds; cache with 5-minute safety margin
  tokenExpiresAt = Date.now() + (data.expiresIn || 86400) * 1000;

  return cachedToken;
}

// ─── Exported helper for other API routes ───────────────────────────────────

module.exports = { getAccessToken, POYNT_BASE };

// ─── HTTP handler (diagnostic / manual token refresh) ───────────────────────

module.exports.default = async function handler(req, res) {
  // CORS
  if (!applyCors(req, res)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  // Rate limit
  const ip = getClientIp(req);
  if (isRateLimited(ip)) return res.status(429).json({ error: 'rate_limited' });

  // Dashboard password check
  const { password } = req.body || {};
  if (!password || password !== process.env.DASHBOARD_PASSWORD) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // Missing config
  if (!POYNT_APP_ID || !POYNT_PRIVATE_KEY) {
    return res.status(500).json({ error: 'poynt_not_configured' });
  }

  try {
    const token = await getAccessToken();
    return res.status(200).json({ ok: true, tokenPreview: token.slice(0, 12) + '…' });
  } catch (err) {
    console.error('poynt-auth error:', err);
    return res.status(502).json({ error: 'token_exchange_failed', detail: err.message });
  }
};
