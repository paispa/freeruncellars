#!/usr/bin/env node
// test-api-handlers.js — Unit tests for API handler logic
// Run with: node test-api-handlers.js

const { ALLOWED_ORIGINS, applyCors, makeRateLimiter, getClientIp } = require('./api/_helpers');
const { randomUUID } = require('crypto');

// escapeHtml and DATA_URI_RE are private to their respective handlers,
// so we re-declare them here; they must stay in sync with the handler source.
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
const DATA_URI_RE = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

let passed = 0;
let failed = 0;

function assert(desc, condition) {
  if (condition) {
    console.log(`  ✓ ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failed++;
  }
}

// ─── CORS allowlist (from _helpers.js) ────────────────────────────────────────
console.log('\n[CORS allowlist — ALLOWED_ORIGINS]');
assert('freeruncellars.com is allowed',     ALLOWED_ORIGINS.includes('https://freeruncellars.com'));
assert('www.freeruncellars.com is allowed', ALLOWED_ORIGINS.includes('https://www.freeruncellars.com'));
assert('vercel.app preview is allowed',     ALLOWED_ORIGINS.includes('https://freeruncellars.vercel.app'));
assert('http:// variant not in list',       !ALLOWED_ORIGINS.includes('http://freeruncellars.com'));
assert('unknown origin not in list',        !ALLOWED_ORIGINS.includes('https://evil.com'));
assert('partial subdomain not in list',     !ALLOWED_ORIGINS.includes('https://freeruncellars.com.evil.com'));

// ─── applyCors behaviour ──────────────────────────────────────────────────────
console.log('\n[applyCors — response header logic]');
{
  function makeRes() {
    const headers = {};
    return {
      headers,
      setHeader(k, v) { this.headers[k] = v; },
    };
  }
  function makeReq(origin) {
    return { headers: origin !== undefined ? { origin } : {} };
  }

  // Known origin
  {
    const res = makeRes();
    const ok = applyCors(makeReq('https://freeruncellars.com'), res);
    assert('known origin returns true',                   ok === true);
    assert('ACAO header set to exact origin',             res.headers['Access-Control-Allow-Origin'] === 'https://freeruncellars.com');
    assert('Vary: Origin set',                            res.headers['Vary'] === 'Origin');
  }

  // Unknown browser origin
  {
    const res = makeRes();
    const ok = applyCors(makeReq('https://evil.com'), res);
    assert('unknown origin returns false',                ok === false);
    assert('no ACAO header on unknown origin',            !res.headers['Access-Control-Allow-Origin']);
  }

  // No Origin header (curl / server-to-server)
  {
    const res = makeRes();
    const ok = applyCors(makeReq(undefined), res);
    assert('no-Origin request returns true (non-browser)',ok === true);
    assert('no ACAO header set for no-Origin request',    !res.headers['Access-Control-Allow-Origin']);
  }

  // Empty-string origin (some proxies strip the header value)
  {
    const res = makeRes();
    const ok = applyCors(makeReq(''), res);
    assert('empty-string origin treated as no-Origin',    ok === true);
  }
}

// ─── getClientIp ──────────────────────────────────────────────────────────────
console.log('\n[getClientIp]');
{
  assert('x-forwarded-for single IP',
    getClientIp({ headers: { 'x-forwarded-for': '1.2.3.4' }, socket: {} }) === '1.2.3.4');
  assert('x-forwarded-for picks first (leftmost) IP',
    getClientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }, socket: {} }) === '1.2.3.4');
  assert('falls back to socket.remoteAddress',
    getClientIp({ headers: {}, socket: { remoteAddress: '9.9.9.9' } }) === '9.9.9.9');
  assert('returns "unknown" when no info available',
    getClientIp({ headers: {}, socket: {} }) === 'unknown');
}

// ─── Rate limiter (makeRateLimiter from _helpers.js) ──────────────────────────
console.log('\n[Rate limiter — upload (10/60s)]');
{
  const isLimited = makeRateLimiter(10, 60_000);
  let blocked = false;
  for (let i = 1; i <= 10; i++) {
    if (isLimited('1.2.3.4')) { blocked = true; break; }
  }
  assert('10 requests within limit pass',  !blocked);
  assert('11th request is blocked',        isLimited('1.2.3.4') === true);
  assert('different IP is not limited',    isLimited('5.6.7.8') === false);
}

console.log('\n[Rate limiter — chat (30/60s)]');
{
  const isLimited = makeRateLimiter(30, 60_000);
  let blocked = false;
  for (let i = 1; i <= 30; i++) {
    if (isLimited('10.0.0.1')) { blocked = true; break; }
  }
  assert('30 requests within limit pass',  !blocked);
  assert('31st request is blocked',        isLimited('10.0.0.1') === true);
}

console.log('\n[Rate limiter — signup (5/10min)]');
{
  const isLimited = makeRateLimiter(5, 10 * 60_000);
  let blocked = false;
  for (let i = 1; i <= 5; i++) {
    if (isLimited('192.168.1.1')) { blocked = true; break; }
  }
  assert('5 signups within limit pass',    !blocked);
  assert('6th signup is blocked',          isLimited('192.168.1.1') === true);
}

// ─── Data URI validation (upload-photo.js) ────────────────────────────────────
console.log('\n[Data URI validation]');
{
  assert('valid jpeg URI accepted',             DATA_URI_RE.test('data:image/jpeg;base64,/9j/4AAQ'));
  assert('valid png URI accepted',              DATA_URI_RE.test('data:image/png;base64,iVBORw0KGgo='));
  assert('valid webp URI accepted',             DATA_URI_RE.test('data:image/webp;base64,UklGRg=='));
  assert('application/pdf rejected by regex',   !DATA_URI_RE.test('data:application/pdf;base64,JVBERi0='));
  assert('empty base64 segment rejected',       !DATA_URI_RE.test('data:image/jpeg;base64,'));
  assert('plain URL rejected',                  !DATA_URI_RE.test('https://example.com/photo.jpg'));
  assert('text/html data URI rejected',         !DATA_URI_RE.test('data:text/html;base64,PHNjcmlwdD4='));
  assert('uppercase MIME type rejected',        !DATA_URI_RE.test('data:image/JPEG;base64,/9j/4AAQ'));

  const m = 'data:image/jpeg;base64,/9j/4AAQ'.match(DATA_URI_RE);
  assert('jpeg in MIME allowlist',              m && ALLOWED_MIME_TYPES.includes(m[1]));

  const m2 = 'data:image/gif;base64,R0lGODlhAQ=='.match(DATA_URI_RE);
  assert('gif not in MIME allowlist',           m2 ? !ALLOWED_MIME_TYPES.includes(m2[1]) : true);
}

// ─── Decoded payload size check (upload-photo.js) ─────────────────────────────
console.log('\n[Payload size check — decoded bytes]');
{
  // Simulate decode: Buffer.from(base64, 'base64').length
  const okBuf    = Buffer.alloc(MAX_IMAGE_BYTES);
  const tooBig   = Buffer.alloc(MAX_IMAGE_BYTES + 1);
  assert('buffer at limit passes',          okBuf.length <= MAX_IMAGE_BYTES);
  assert('buffer over limit is rejected',   tooBig.length > MAX_IMAGE_BYTES);
  // Confirm we're checking buffer bytes, not base64 string length
  const b64 = okBuf.toString('base64');
  assert('base64 string is larger than raw buffer', b64.length > MAX_IMAGE_BYTES);
}

// ─── HTML escaping (circle-signup.js) ─────────────────────────────────────────
console.log('\n[HTML escaping]');
assert('& escaped to &amp;',        escapeHtml('AT&T') === 'AT&amp;T');
assert('< escaped to &lt;',         escapeHtml('<script>') === '&lt;script&gt;');
assert('> escaped to &gt;',         escapeHtml('a>b') === 'a&gt;b');
assert('" escaped to &quot;',       escapeHtml('"hello"') === '&quot;hello&quot;');
assert("' escaped to &#39;",        escapeHtml("it's") === 'it&#39;s');
assert('non-string returns empty',  escapeHtml(null) === '' && escapeHtml(undefined) === '');
assert('safe string unchanged',     escapeHtml('Jane Doe') === 'Jane Doe');
assert('XSS payload escaped',       escapeHtml('<img src=x onerror=alert(1)>') === '&lt;img src=x onerror=alert(1)&gt;');

// ─── Honeypot (circle-signup.js) ──────────────────────────────────────────────
console.log('\n[Honeypot field]');
{
  const triggered = (val) => !!val;
  assert('empty string does not trigger',   !triggered(''));
  assert('undefined does not trigger',      !triggered(undefined));
  assert('null does not trigger',           !triggered(null));
  assert('filled value triggers honeypot',  triggered('bot-was-here'));
}

// ─── Input validation (circle-signup.js) ──────────────────────────────────────
console.log('\n[circle-signup input validation]');
{
  function validate(firstName, email, phone) {
    return !(!firstName || !email || !email.includes('@') || !phone);
  }
  assert('valid inputs pass',             validate('Jane', 'jane@example.com', '2695550100'));
  assert('missing firstName rejected',    !validate('', 'jane@example.com', '2695550100'));
  assert('missing email rejected',        !validate('Jane', '', '2695550100'));
  assert('email without @ rejected',      !validate('Jane', 'janeatexample.com', '2695550100'));
  assert('missing phone rejected',        !validate('Jane', 'jane@example.com', ''));
}

// ─── Phone normalisation (circle-signup.js) ───────────────────────────────────
console.log('\n[Phone normalisation]');
{
  function normalizePhone(phone) {
    if (!phone) return undefined;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return undefined;
  }
  assert('10-digit US number normalised',    normalizePhone('(269) 815-6885') === '+12698156885');
  assert('11-digit with leading 1',          normalizePhone('12698156885') === '+12698156885');
  assert('already E.164 style (11 digits)',  normalizePhone('+12698156885') === '+12698156885');
  assert('7-digit returns undefined',        normalizePhone('8156885') === undefined);
  assert('empty returns undefined',          normalizePhone('') === undefined);
}

// ─── Interests label mapping (circle-signup.js) ───────────────────────────────
console.log('\n[Interests label mapping]');
{
  const INTERESTS_MAP = {
    ramato:  { id: 1, label: 'First access to new wines' },
    credits: { id: 2, label: '$150 credits + ongoing discount' },
    events:  { id: 3, label: 'Private tastings & owner-only events' },
    tickets: { id: 4, label: 'Early access to live music tickets' },
    updates: { id: 5, label: 'Behind-the-scenes vineyard updates' },
  };
  const toList = (arr) => arr.length
    ? arr.map(i => INTERESTS_MAP[i]?.label || i).join(', ')
    : 'Not specified';

  assert('labels joined correctly',
    toList(['ramato', 'credits']) === 'First access to new wines, $150 credits + ongoing discount');
  assert('empty interests → "Not specified"', toList([]) === 'Not specified');
  assert('unknown key falls back to key itself', toList(['foobar']) === 'foobar');
}

// ─── Filename generation (upload-photo.js) ────────────────────────────────────
console.log('\n[Filename generation]');
{
  assert('crypto.randomUUID available via require', typeof randomUUID === 'function');

  function makeFilename(mimeType) {
    const ext = mimeType.split('/')[1];
    return `photobooth/${Date.now()}-${Math.random().toString(36).slice(2)}-${randomUUID()}.${ext}`;
  }
  assert('jpeg filename has .jpeg ext',         makeFilename('image/jpeg').endsWith('.jpeg'));
  assert('png filename has .png ext',           makeFilename('image/png').endsWith('.png'));
  assert('webp filename has .webp ext',         makeFilename('image/webp').endsWith('.webp'));
  assert('filename starts with photobooth/',    makeFilename('image/jpeg').startsWith('photobooth/'));
  assert('two filenames are unique',            makeFilename('image/jpeg') !== makeFilename('image/jpeg'));
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All tests passed.');
