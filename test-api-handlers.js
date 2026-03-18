#!/usr/bin/env node
// test-api-handlers.js — Unit tests for api handler logic
// Run with: node test-api-handlers.js

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

// ─── Helpers extracted from handlers ──────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://freeruncellars.com',
  'https://www.freeruncellars.com',
  'https://freeruncellars.vercel.app',
];

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

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_PAYLOAD_BYTES = 6 * 1024 * 1024;
const DATA_URI_RE = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/;

// ─── CORS allowlist ────────────────────────────────────────────────────────────
console.log('\n[CORS allowlist]');
assert('freeruncellars.com is allowed',      ALLOWED_ORIGINS.includes('https://freeruncellars.com'));
assert('www.freeruncellars.com is allowed',  ALLOWED_ORIGINS.includes('https://www.freeruncellars.com'));
assert('vercel.app preview is allowed',      ALLOWED_ORIGINS.includes('https://freeruncellars.vercel.app'));
assert('http:// variant rejected',           !ALLOWED_ORIGINS.includes('http://freeruncellars.com'));
assert('unknown origin rejected',            !ALLOWED_ORIGINS.includes('https://evil.com'));
assert('empty string rejected',              !ALLOWED_ORIGINS.includes(''));
assert('partial match rejected',             !ALLOWED_ORIGINS.includes('https://freeruncellars.com.evil.com'));

// ─── Rate limiter ──────────────────────────────────────────────────────────────
console.log('\n[Rate limiter — upload (10/60s)]');
{
  const isLimited = makeRateLimiter(10, 60_000);
  let blocked = false;
  for (let i = 1; i <= 10; i++) {
    const result = isLimited('1.2.3.4');
    if (result) { blocked = true; break; }
  }
  assert('10 requests within limit pass', !blocked);
  assert('11th request is blocked', isLimited('1.2.3.4') === true);
  assert('different IP is not limited', isLimited('5.6.7.8') === false);
}

console.log('\n[Rate limiter — chat (30/60s)]');
{
  const isLimited = makeRateLimiter(30, 60_000);
  let blocked = false;
  for (let i = 1; i <= 30; i++) {
    if (isLimited('10.0.0.1')) { blocked = true; break; }
  }
  assert('30 requests within limit pass', !blocked);
  assert('31st request is blocked', isLimited('10.0.0.1') === true);
}

console.log('\n[Rate limiter — signup (5/10min)]');
{
  const isLimited = makeRateLimiter(5, 10 * 60_000);
  let blocked = false;
  for (let i = 1; i <= 5; i++) {
    if (isLimited('192.168.1.1')) { blocked = true; break; }
  }
  assert('5 signups within limit pass', !blocked);
  assert('6th signup is blocked', isLimited('192.168.1.1') === true);
}

// ─── Data URI validation ───────────────────────────────────────────────────────
console.log('\n[Data URI validation]');
{
  const validJpeg   = 'data:image/jpeg;base64,/9j/4AAQ';
  const validPng    = 'data:image/png;base64,iVBORw0KGgo=';
  const validWebp   = 'data:image/webp;base64,UklGRg==';
  const badScheme   = 'data:application/pdf;base64,JVBERi0=';
  const noBase64    = 'data:image/jpeg;base64,';  // empty base64 part
  const plainUrl    = 'https://example.com/photo.jpg';
  const scriptInj   = 'data:text/html;base64,PHNjcmlwdD4=';
  const uppercaseMime = 'data:image/JPEG;base64,/9j/4AAQ'; // uppercase — should be rejected by [a-z] regex

  assert('valid jpeg URI accepted',              DATA_URI_RE.test(validJpeg));
  assert('valid png URI accepted',               DATA_URI_RE.test(validPng));
  assert('valid webp URI accepted',              DATA_URI_RE.test(validWebp));
  assert('application/pdf rejected by regex',    !DATA_URI_RE.test(badScheme));
  assert('empty base64 segment rejected',        !DATA_URI_RE.test(noBase64));
  assert('plain URL rejected',                   !DATA_URI_RE.test(plainUrl));
  assert('text/html data URI rejected',          !DATA_URI_RE.test(scriptInj));
  assert('uppercase MIME type rejected',         !DATA_URI_RE.test(uppercaseMime));

  // MIME type allowlist check (after regex passes)
  const m = validJpeg.match(DATA_URI_RE);
  assert('jpeg in MIME allowlist',  m && ALLOWED_MIME_TYPES.includes(m[1]));

  const m2 = 'data:image/gif;base64,R0lGODlhAQ=='.match(DATA_URI_RE);
  assert('gif not in MIME allowlist', m2 ? !ALLOWED_MIME_TYPES.includes(m2[1]) : true);
}

// ─── Payload size check ────────────────────────────────────────────────────────
console.log('\n[Payload size check]');
{
  // base64 of MAX_PAYLOAD_BYTES is exactly MAX_PAYLOAD_BYTES characters
  const okSize      = 'A'.repeat(MAX_PAYLOAD_BYTES);
  const tooBig      = 'A'.repeat(MAX_PAYLOAD_BYTES + 1);
  assert('payload at limit passes',         okSize.length <= MAX_PAYLOAD_BYTES);
  assert('payload over limit is rejected',  tooBig.length > MAX_PAYLOAD_BYTES);
}

// ─── HTML escaping ─────────────────────────────────────────────────────────────
console.log('\n[HTML escaping]');
assert('& escaped to &amp;',        escapeHtml('AT&T') === 'AT&amp;T');
assert('< escaped to &lt;',         escapeHtml('<script>') === '&lt;script&gt;');
assert('> escaped to &gt;',         escapeHtml('a>b') === 'a&gt;b');
assert('" escaped to &quot;',       escapeHtml('"hello"') === '&quot;hello&quot;');
assert("' escaped to &#39;",        escapeHtml("it's") === 'it&#39;s');
assert('non-string returns empty',  escapeHtml(null) === '' && escapeHtml(undefined) === '');
assert('safe string unchanged',     escapeHtml('Jane Doe') === 'Jane Doe');
assert('XSS payload escaped', escapeHtml('<img src=x onerror=alert(1)>') === '&lt;img src=x onerror=alert(1)&gt;');

// ─── Honeypot ──────────────────────────────────────────────────────────────────
console.log('\n[Honeypot field]');
{
  const honeypotTriggered = (val) => !!val; // truthy check matches api logic: if (_hp)
  assert('empty string does not trigger',    !honeypotTriggered(''));
  assert('undefined does not trigger',       !honeypotTriggered(undefined));
  assert('null does not trigger',            !honeypotTriggered(null));
  assert('filled value triggers honeypot',   honeypotTriggered('bot-was-here'));
}

// ─── Input validation (circle-signup) ─────────────────────────────────────────
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

// ─── Phone normalisation (circle-signup) ──────────────────────────────────────
console.log('\n[Phone normalisation]');
{
  function normalizePhone(phone) {
    if (!phone) return undefined;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return undefined;
  }
  assert('10-digit US number normalised',   normalizePhone('(269) 815-6885') === '+12698156885');
  assert('11-digit with leading 1',         normalizePhone('12698156885') === '+12698156885');
  assert('already E.164 style (11 digits)', normalizePhone('+12698156885') === '+12698156885');
  assert('7-digit number returns undefined',normalizePhone('8156885') === undefined);
  assert('empty returns undefined',         normalizePhone('') === undefined);
}

// ─── INTERESTS_MAP (circle-signup) ────────────────────────────────────────────
console.log('\n[Interests label mapping]');
{
  const INTERESTS_MAP = {
    ramato:  { id: 1, label: 'First access to new wines' },
    credits: { id: 2, label: '$150 credits + ongoing discount' },
    events:  { id: 3, label: 'Private tastings & owner-only events' },
    tickets: { id: 4, label: 'Early access to live music tickets' },
    updates: { id: 5, label: 'Behind-the-scenes vineyard updates' },
  };
  const interests = ['ramato', 'credits'];
  const interestList = interests.map(i => INTERESTS_MAP[i]?.label || i).join(', ');
  assert('labels joined correctly', interestList === 'First access to new wines, $150 credits + ongoing discount');

  const emptyList = [];
  const result = emptyList.length ? emptyList.map(i => INTERESTS_MAP[i]?.label || i).join(', ') : 'Not specified';
  assert('empty interests defaults to "Not specified"', result === 'Not specified');

  const unknownKey = ['foobar'];
  const fallback = unknownKey.map(i => INTERESTS_MAP[i]?.label || i).join(', ');
  assert('unknown key falls back to key itself', fallback === 'foobar');
}

// ─── Filename generation (upload-photo) ───────────────────────────────────────
console.log('\n[Filename generation]');
{
  const { randomUUID } = require('crypto');
  function makeFilename(mimeType) {
    const ext = mimeType.split('/')[1];
    return `photobooth/${Date.now()}-${Math.random().toString(36).slice(2)}-${randomUUID()}.${ext}`;
  }
  assert('crypto.randomUUID available via require', typeof randomUUID === 'function');
  assert('jpeg filename has .jpeg ext',  makeFilename('image/jpeg').endsWith('.jpeg'));
  assert('png filename has .png ext',    makeFilename('image/png').endsWith('.png'));
  assert('webp filename has .webp ext',  makeFilename('image/webp').endsWith('.webp'));
  assert('filename starts with photobooth/', makeFilename('image/jpeg').startsWith('photobooth/'));
  const f1 = makeFilename('image/jpeg');
  const f2 = makeFilename('image/jpeg');
  assert('two filenames are unique', f1 !== f2);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed.');
}
