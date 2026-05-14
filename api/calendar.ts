import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { CalendarEvent, RoomType } from '../src/types';

const SLOT_TIMES: Record<string, { start: string; end: string }> = {
  '午前': { start: '09:00', end: '12:00' },
  '午後': { start: '13:00', end: '16:00' },
  '夜間': { start: '17:00', end: '20:00' },
};

/**
 * GET /api/calendar?year=2026&month=5
 *
 * GAS Web App 経由でスプレッドシートからイベントを取得して返す。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gasUrl = process.env.GAS_WEBAPP_URL;
  if (!gasUrl) {
    return res.status(500).json({ error: 'Missing GAS_WEBAPP_URL' });
  }

  const { year, month } = req.query;
  if (!year || !month) {
    return res.status(400).json({ error: 'year and month query params required' });
  }

  try {
    const url = `${gasUrl}?action=load&year=${year}&month=${month}`;
    const gasRes = await fetch(url, { redirect: 'follow' });
    if (!gasRes.ok) throw new Error(`GAS API error ${gasRes.status}`);

    const data = await gasRes.json() as {
      year: number;
      month: number;
      events: Record<string, { id: string; title: string; org: string; slot: string; room: string; day: number }>;
    };

    // GAS形式 → CalendarEvent[] に変換
    const events: CalendarEvent[] = Object.entries(data.events || {}).map(([key, evt]) => {
      const times = SLOT_TIMES[evt.slot] || { start: '09:00', end: '12:00' };
      const dateStr = `${data.year}-${String(data.month).padStart(2, '0')}-${String(evt.day).padStart(2, '0')}`;
      return {
        id: evt.id || key,
        summary: evt.title,
        room: (evt.room || null) as RoomType | null,
        start: `${dateStr}T${times.start}:00`,
        end: `${dateStr}T${times.end}:00`,
        date: dateStr,
        startTime: times.start,
        endTime: times.end,
      };
    });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    return res.status(200).json(events);
  } catch (err) {
    console.error('GAS API fetch error:', err);
    return res.status(502).json({ error: 'Failed to fetch events from spreadsheet' });
  }
}
