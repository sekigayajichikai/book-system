import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from '../src/lib/supabase';

/**
 * GET /api/calendar?year=2026&month=5
 *
 * Supabase から予約データを取得して CalendarEvent[] 形式で返す。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { year, month } = req.query;
  if (!year || !month) {
    return res.status(400).json({ error: 'year and month query params required' });
  }

  const y = Number(year);
  const m = Number(month);
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const endDate = `${y}-${String(m + 1 > 12 ? 1 : m + 1).padStart(2, '0')}-01`;

  try {
    const supabase = getSupabase();

    // 予約データ取得
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .gte('date', startDate)
      .lt('date', m === 12 ? `${y + 1}-01-01` : endDate)
      .in('status', ['CONFIRMED', 'PENDING']);

    if (error) throw error;

    // 時間帯マスタ取得
    const { data: slots } = await supabase
      .from('booking_time_slots')
      .select('slot_key, start_time, end_time');

    const slotMap: Record<string, { start: string; end: string }> = {};
    (slots || []).forEach(s => {
      slotMap[s.slot_key] = { start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) };
    });

    // CalendarEvent[] 形式に変換
    const events = (bookings || []).map(b => {
      const times = slotMap[b.slot] || { start: '09:00', end: '12:00' };
      return {
        id: b.id,
        summary: b.title,
        room: b.room,
        start: `${b.date}T${times.start}:00`,
        end: `${b.date}T${times.end}:00`,
        date: b.date,
        startTime: times.start,
        endTime: times.end,
      };
    });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
    return res.status(200).json(events);
  } catch (err: any) {
    console.error('Supabase calendar fetch error:', err);
    return res.status(500).json({ error: '予約データの取得に失敗しました', detail: err?.message || String(err) });
  }
}
