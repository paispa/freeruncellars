// api/calendar.js — Vercel serverless proxy for Free Run Cellars ICS feed
// Lives at: https://www.frcwine.com/api/calendar
// No third-party CORS proxy needed — this runs on YOUR domain

const ICS_URL = 'https://outlook.office365.com/owa/calendar/df404380dcae40ce9d5e5cae23fc980b@frcwine.com/2bffd8e2d0c6472484e93fb53c70a23b18073354100263554948/calendar.ics';

export default async function handler(req, res) {
  try {
    const response = await fetch(ICS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FreeRunCellars/1.0)',
      },
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Upstream returned ${response.status}` });
    }

    const text = await response.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600'); // cache 5 min
    res.status(200).send(text);

  } catch (err) {
    console.error('Calendar proxy error:', err);
    res.status(500).json({ error: 'Failed to fetch calendar' });
  }
}
