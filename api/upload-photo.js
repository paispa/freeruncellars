// api/upload-photo.js — Temporary photo storage for photo booth
// Uploads a base64 image to imgbb with a 7-day expiration.
// Returns the public URL so EmailJS only carries a tiny link, not a blob.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'IMGBB_API_KEY not configured' });

  const { image } = req.body || {};
  if (!image) return res.status(400).json({ error: 'image required' });

  // Strip data URI prefix (data:image/jpeg;base64,...)
  const base64 = image.replace(/^data:image\/\w+;base64,/, '');

  const form = new FormData();
  form.append('key', apiKey);
  form.append('image', base64);
  form.append('expiration', '604800'); // 7 days in seconds

  const upstream = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: form,
  });

  const data = await upstream.json();
  if (!data.success) {
    console.error('imgbb upload failed:', data);
    return res.status(502).json({ error: 'Upload failed', detail: data?.error?.message });
  }

  res.status(200).json({ url: data.data.url });
};
