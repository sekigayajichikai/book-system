import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchCalendarEvents } from '../src/lib/google-calendar';

/**
 * GET /api/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Googleカレンダーから自治会館使用状況イベントを取得して返す。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!calendarId || !apiKey) {
    return res.status(500).json({ error: 'Missing GOOGLE_CALENDAR_ID or GOOGLE_API_KEY' });
  }

  const { start, end } = req.query;
  if (typeof start !== 'string' || typeof end !== 'string') {
    return res.status(400).json({ error: 'start and end query params required (YYYY-MM-DD)' });
  }

  try {
    const events = await fetchCalendarEvents(calendarId, apiKey, start, end);
    // 1時間キャッシュ（ISR的に）
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    return res.status(200).json(events);
  } catch (err) {
    console.error('Calendar fetch error:', err);
    return res.status(502).json({ error: 'Failed to fetch calendar events' });
  }
}
