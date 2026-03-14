// api/upload-photo.js — Photo storage for photo booth via Vercel Blob
// Receives a base64 image, uploads binary to Vercel Blob, returns the public URL.
// Requires BLOB_READ_WRITE_TOKEN env var (auto-created when you add a Blob store
// in the Vercel dashboard under Storage → Create Database → Blob).

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not configured' });

  const { image } = req.body || {};
  if (!image) return res.status(400).json({ error: 'image required' });

  // Convert base64 data URI to binary buffer
  const base64 = image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');

  const filename = `photobooth/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

  const upstream = await fetch(`https://blob.vercel-storage.com/${filename}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'image/jpeg',
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
