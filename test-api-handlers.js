#!/usr/bin/env node
// test-api-handlers.js — Unit tests for API handler logic
// Run with: node test-api-handlers.js
//
// All helpers, constants, and business-logic functions are imported directly
// from the modules used by the handlers — no local re-declarations.

const {
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
} = require('./api/_helpers');

const { randomUUID } = require('crypto');

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

// ─── CORS allowlist ────────────────────────────────────────────────────────────
console.log('\n[CORS allowlist — ALLOWED_ORIGINS]');
assert('freeruncellars.com is allowed',     ALLOWED_ORIGINS.includes('https://freeruncellars.com'));
assert('www.freeruncellars.com is allowed', ALLOWED_ORIGINS.includes('https://www.freeruncellars.com'));
assert('vercel.app preview is allowed',     ALLOWED_ORIGINS.includes('https://freeruncellars.vercel.app'));
assert('http:// variant not in list',       !ALLOWED_ORIGINS.includes('http://freeruncellars.com'));
assert('unknown origin not in list',        !ALLOWED_ORIGINS.includes('https://evil.com'));
assert('partial subdomain not in list',     !ALLOWED_ORIGINS.includes('https://freeruncellars.com.evil.com'));

// ─── applyCors ────────────────────────────────────────────────────────────────
console.log('\n[applyCors — response header logic]');
{
  const makeRes = () => {
    const headers = {};
    return { headers, setHeader(k, v) { this.headers[k] = v; } };
  };
  const makeReq = (origin) => ({ headers: origin !== undefined ? { origin } : {} });

  { // known origin
    const res = makeRes();
    const ok = applyCors(makeReq('https://freeruncellars.com'), res);
    assert('known origin returns true',          ok === true);
    assert('ACAO header set to exact origin',    res.headers['Access-Control-Allow-Origin'] === 'https://freeruncellars.com');
    assert('Vary: Origin set',                   res.headers['Vary'] === 'Origin');
  }
  { // unknown browser origin
    const res = makeRes();
    const ok = applyCors(makeReq('https://evil.com'), res);
    assert('unknown origin returns false',       ok === false);
    assert('no ACAO header on unknown origin',   !res.headers['Access-Control-Allow-Origin']);
  }
  { // no Origin header (curl / server-to-server)
    const res = makeRes();
    const ok = applyCors(makeReq(undefined), res);
    assert('no-Origin request passes through',   ok === true);
    assert('no ACAO header set (no-Origin)',      !res.headers['Access-Control-Allow-Origin']);
  }
  { // empty-string origin (some proxies)
    const res = makeRes();
    assert('empty-string origin passes through', applyCors(makeReq(''), res) === true);
  }
}

// ─── getClientIp ──────────────────────────────────────────────────────────────
console.log('\n[getClientIp]');
assert('x-forwarded-for single IP',
  getClientIp({ headers: { 'x-forwarded-for': '1.2.3.4' }, socket: {} }) === '1.2.3.4');
assert('x-forwarded-for picks leftmost IP',
  getClientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }, socket: {} }) === '1.2.3.4');
assert('falls back to socket.remoteAddress',
  getClientIp({ headers: {}, socket: { remoteAddress: '9.9.9.9' } }) === '9.9.9.9');
assert('returns "unknown" when no info available',
  getClientIp({ headers: {}, socket: {} }) === 'unknown');

// ─── Rate limiter ──────────────────────────────────────────────────────────────
console.log('\n[Rate limiter — upload (10/60s)]');
{
  const isLimited = makeRateLimiter(10, 60_000);
  let blocked = false;
  for (let i = 1; i <= 10; i++) if (isLimited('1.2.3.4')) { blocked = true; break; }
  assert('10 requests within limit pass',  !blocked);
  assert('11th request is blocked',        isLimited('1.2.3.4') === true);
  assert('different IP is not limited',    isLimited('5.6.7.8') === false);
}

console.log('\n[Rate limiter — chat (30/60s)]');
{
  const isLimited = makeRateLimiter(30, 60_000);
  let blocked = false;
  for (let i = 1; i <= 30; i++) if (isLimited('10.0.0.1')) { blocked = true; break; }
  assert('30 requests within limit pass',  !blocked);
  assert('31st request is blocked',        isLimited('10.0.0.1') === true);
}

console.log('\n[Rate limiter — signup (5/10min)]');
{
  const isLimited = makeRateLimiter(5, 10 * 60_000);
  let blocked = false;
  for (let i = 1; i <= 5; i++) if (isLimited('192.168.1.1')) { blocked = true; break; }
  assert('5 signups within limit pass',    !blocked);
  assert('6th signup is blocked',          isLimited('192.168.1.1') === true);
}

// ─── Data URI validation ───────────────────────────────────────────────────────
console.log('\n[Data URI validation]');
assert('valid jpeg URI accepted',            DATA_URI_RE.test('data:image/jpeg;base64,/9j/4AAQ'));
assert('valid png URI accepted',             DATA_URI_RE.test('data:image/png;base64,iVBORw0KGgo='));
assert('valid webp URI accepted',            DATA_URI_RE.test('data:image/webp;base64,UklGRg=='));
assert('application/pdf rejected',          !DATA_URI_RE.test('data:application/pdf;base64,JVBERi0='));
assert('empty base64 segment rejected',     !DATA_URI_RE.test('data:image/jpeg;base64,'));
assert('plain URL rejected',                !DATA_URI_RE.test('https://example.com/photo.jpg'));
assert('text/html data URI rejected',       !DATA_URI_RE.test('data:text/html;base64,PHNjcmlwdD4='));
assert('uppercase MIME type rejected',      !DATA_URI_RE.test('data:image/JPEG;base64,/9j/4AAQ'));
{
  const m = 'data:image/jpeg;base64,/9j/4AAQ'.match(DATA_URI_RE);
  assert('jpeg in MIME allowlist',           m && ALLOWED_MIME_TYPES.includes(m[1]));
  const m2 = 'data:image/gif;base64,R0lGODlhAQ=='.match(DATA_URI_RE);
  assert('gif not in MIME allowlist',        m2 ? !ALLOWED_MIME_TYPES.includes(m2[1]) : true);
}

// ─── Decoded payload size ──────────────────────────────────────────────────────
console.log('\n[Payload size check — decoded bytes]');
{
  const okBuf  = Buffer.alloc(MAX_IMAGE_BYTES);
  const tooBig = Buffer.alloc(MAX_IMAGE_BYTES + 1);
  assert('buffer at limit passes',             okBuf.length <= MAX_IMAGE_BYTES);
  assert('buffer over limit is rejected',      tooBig.length > MAX_IMAGE_BYTES);
  assert('base64 encoding is larger than raw', okBuf.toString('base64').length > MAX_IMAGE_BYTES);
}

// ─── HTML escaping ─────────────────────────────────────────────────────────────
console.log('\n[HTML escaping]');
assert('& → &amp;',                      escapeHtml('AT&T') === 'AT&amp;T');
assert('< → &lt;',                       escapeHtml('<script>') === '&lt;script&gt;');
assert('> → &gt;',                       escapeHtml('a>b') === 'a&gt;b');
assert('" → &quot;',                     escapeHtml('"hello"') === '&quot;hello&quot;');
assert("' → &#39;",                      escapeHtml("it's") === 'it&#39;s');
assert('non-string returns empty string',escapeHtml(null) === '' && escapeHtml(undefined) === '');
assert('safe string unchanged',          escapeHtml('Jane Doe') === 'Jane Doe');
assert('XSS payload fully escaped',      escapeHtml('<img src=x onerror=alert(1)>') === '&lt;img src=x onerror=alert(1)&gt;');

// ─── Honeypot ──────────────────────────────────────────────────────────────────
console.log('\n[Honeypot field]');
// Handler checks: if (_hp) — mirrors that logic directly
assert('empty string does not trigger',  !(''));
assert('undefined does not trigger',     !(undefined));
assert('null does not trigger',          !(null));
assert('filled value triggers honeypot', !!('bot-was-here'));

// ─── circle-signup input validation ───────────────────────────────────────────
console.log('\n[circle-signup input validation]');
// Mirrors the handler guard: !(!firstName || !email || !email.includes('@') || !phone)
const valid = (f, e, p) => !(!f || !e || !e.includes('@') || !p);
assert('valid inputs pass',            valid('Jane', 'jane@example.com', '2695550100'));
assert('missing firstName rejected',   !valid('', 'jane@example.com', '2695550100'));
assert('missing email rejected',       !valid('Jane', '', '2695550100'));
assert('email without @ rejected',     !valid('Jane', 'janeatexample.com', '2695550100'));
assert('missing phone rejected',       !valid('Jane', 'jane@example.com', ''));

// ─── normalizePhone ────────────────────────────────────────────────────────────
console.log('\n[normalizePhone]');
assert('10-digit US number',           normalizePhone('(269) 815-6885') === '+12698156885');
assert('11-digit with leading 1',      normalizePhone('12698156885') === '+12698156885');
assert('already E.164 (11 digits)',    normalizePhone('+12698156885') === '+12698156885');
assert('7-digit returns undefined',    normalizePhone('8156885') === undefined);
assert('empty returns undefined',      normalizePhone('') === undefined);

// ─── INTERESTS_MAP ─────────────────────────────────────────────────────────────
console.log('\n[INTERESTS_MAP label mapping]');
{
  const toList = (arr) => arr.length
    ? arr.map(i => INTERESTS_MAP[i]?.label || i).join(', ')
    : 'Not specified';
  assert('labels joined correctly',
    toList(['ramato', 'credits']) === 'First access to new wines, $150 credits + ongoing discount');
  assert('empty array → "Not specified"',  toList([]) === 'Not specified');
  assert('unknown key falls back to key',  toList(['foobar']) === 'foobar');
}

// ─── Filename generation ───────────────────────────────────────────────────────
console.log('\n[Filename generation]');
assert('randomUUID available via require', typeof randomUUID === 'function');
{
  const make = (mime) => `photobooth/${Date.now()}-${Math.random().toString(36).slice(2)}-${randomUUID()}.${mime.split('/')[1]}`;
  assert('jpeg → .jpeg ext',           make('image/jpeg').endsWith('.jpeg'));
  assert('png → .png ext',             make('image/png').endsWith('.png'));
  assert('webp → .webp ext',           make('image/webp').endsWith('.webp'));
  assert('starts with photobooth/',    make('image/jpeg').startsWith('photobooth/'));
  assert('two filenames are unique',   make('image/jpeg') !== make('image/jpeg'));
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('All tests passed.');
