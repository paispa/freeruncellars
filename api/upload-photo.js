// api/upload-photo.js — Photo storage for photo booth via Vercel Blob
// Receives a base64 image, uploads binary to Vercel Blob, returns the public URL.
// Requires BLOB_READ_WRITE_TOKEN env var (auto-created when you add a Blob store
// in the Vercel dashboard under Storage → Create Database → Blob).

const { randomUUID } = require('crypto');

const ALLOWED_ORIGINS = [
  'https://freeruncellars.com',
  'https://www.freeruncellars.com',
  'https://freeruncellars.vercel.app',
];

// Simple in-memory rate limiter: max 10 uploads per IP per 60 seconds
const uploadRateMap = new Map();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = uploadRateMap.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.count = 1;
    entry.windowStart = now;
  } else {
    entry.count += 1;
  }
  uploadRateMap.set(ip, entry);
  return entry.count > RATE_LIMIT_MAX;
}

// Max base64 payload ~6 MB (raw image ~4.5 MB after decode)
const MAX_PAYLOAD_BYTES = 6 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    if (ALLOWED_ORIGINS.includes(origin)) return res.status(200).end();
    return res.status(403).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
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
  const dataUriMatch = image.match(/^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!dataUriMatch) {
    return res.status(400).json({ error: 'Invalid image format. Must be a base64 data URI.' });
  }

  const mimeType = dataUriMatch[1];
  const base64Data = dataUriMatch[2];

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return res.status(400).json({ error: `Unsupported image type "${mimeType}". Allowed: jpeg, png, webp.` });
  }

  if (base64Data.length > MAX_PAYLOAD_BYTES) {
    return res.status(413).json({ error: 'Image too large. Maximum size is ~4.5 MB.' });
  }

  const buffer = Buffer.from(base64Data, 'base64');

  const ext = mimeType.split('/')[1];
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
