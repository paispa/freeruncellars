// api/upload-photo.js — Photo storage for photo booth via Vercel Blob
// Receives a base64 image, uploads binary to Vercel Blob, returns the public URL.
// Requires BLOB_READ_WRITE_TOKEN env var (auto-created when you add a Blob store
// in the Vercel dashboard under Storage → Create Database → Blob).

const { randomUUID }                      = require('crypto');
const { applyCors, makeRateLimiter, getClientIp } = require('./_helpers');

// Max 10 uploads per IP per 60 seconds
const isRateLimited = makeRateLimiter(10, 60_000);

// 5 MB cap on the decoded image buffer
const MAX_IMAGE_BYTES  = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DATA_URI_RE = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    if (!applyCors(req, res)) return res.status(403).end();
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!applyCors(req, res)) return res.status(403).json({ error: 'Forbidden' });

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    console.warn('upload-photo rate limit hit:', ip);
    return res.status(429).json({ error: 'Too many uploads. Please wait a moment and try again.' });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not configured' });

  const { image } = req.body || {};
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'image required' });
  }

  // Validate data URI format
  const match = image.match(DATA_URI_RE);
  if (!match) {
    return res.status(400).json({ error: 'Invalid image format. Must be a base64 data URI.' });
  }

  const mimeType   = match[1];
  const base64Data = match[2];

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return res.status(400).json({ error: `Unsupported image type "${mimeType}". Allowed: jpeg, png, webp.` });
  }

  // Decode first, then enforce the size limit on actual bytes (not base64 chars)
  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length > MAX_IMAGE_BYTES) {
    return res.status(413).json({ error: 'Image too large. Maximum size is 5 MB.' });
  }

  const ext      = mimeType.split('/')[1];
  const filename = `photobooth/${Date.now()}-${Math.random().toString(36).slice(2)}-${randomUUID()}.${ext}`;

  const upstream = await fetch(`https://blob.vercel-storage.com/${filename}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': mimeType,
      'x-api-version': '7',
    },
    body: buffer,
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    console.error('Vercel Blob upload failed:', upstream.status, text);
    return res.status(502).json({ error: 'Upload failed' });
  }

  const { url } = await upstream.json();
  res.status(200).json({ url });
};
