import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/events?year=2026&month=5
 *
 * イベント一覧を取得（住民向け「予定」タブ用）。
 * calendar_events から取得し、facility 型は紐づく bookings の部屋・時間帯情報を結合。
 *
 * オプション:
 *   &visibility=public  — 公開イベントのみ（デフォルト: 全件）
 *   &include_closures=true — 休館日も含める
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { year, month, visibility, include_closures } = req.query;
  if (!year || !month) {
    return res.status(400).json({ error: 'year and month query params required' });
  }

  const y = Number(year);
  const m = Number(month);
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

  try {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

    // イベント取得
    let query = supabase
      .from('calendar_events')
      .select('*')
      .gte('date', startDate)
      .lt('date', endDate);

    // 休館日を除外（デフォルト）
    if (include_closures !== 'true') {
      query = query.neq('event_type', 'closure');
    }

    // visibility フィルタ
    if (visibility === 'public' || visibility === 'internal') {
      query = query.eq('visibility', visibility);
    }

    query = query.order('date').order('start_time');

    const { data: events, error } = await query;
    if (error) throw error;

    // facility 型のイベントには紐づく bookings の部屋・時間帯を結合
    const facilityEventIds = (events || [])
      .filter(e => e.event_type === 'facility')
      .map(e => e.id);

    let bookingsByEvent: Record<string, { rooms: string[]; slots: string[] }> = {};

    if (facilityEventIds.length > 0) {
      const { data: bookings, error: bErr } = await supabase
        .from('bookings')
        .select('event_id, room, slot')
        .in('event_id', facilityEventIds)
        .in('status', ['CONFIRMED', 'PENDING']);

      if (bErr) throw bErr;

      for (const b of bookings || []) {
        if (!bookingsByEvent[b.event_id]) {
          bookingsByEvent[b.event_id] = { rooms: [], slots: [] };
        }
        const entry = bookingsByEvent[b.event_id];
        if (!entry.rooms.includes(b.room)) entry.rooms.push(b.room);
        if (!entry.slots.includes(b.slot)) entry.slots.push(b.slot);
      }
    }

    // 時間帯マスタ取得（start_time / end_time の解決用）
    const { data: slotMaster } = await supabase
      .from('booking_time_slots')
      .select('slot_key, start_time, end_time')
      .order('sort_order');

    const slotMap: Record<string, { start: string; end: string }> = {};
    (slotMaster || []).forEach(s => {
      slotMap[s.slot_key] = { start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) };
    });

    // レスポンス組み立て
    const result = (events || []).map(e => {
      const linked = bookingsByEvent[e.id];
      let startTime = e.start_time ? String(e.start_time).slice(0, 5) : null;
      let endTime = e.end_time ? String(e.end_time).slice(0, 5) : null;

      // facility 型で start_time/end_time が未設定の場合、bookings の時間帯から推定
      if (e.event_type === 'facility' && !startTime && linked) {
        const slotOrder = ['午前', '午後', '夜間'];
        const sorted = linked.slots.sort((a, b) => slotOrder.indexOf(a) - slotOrder.indexOf(b));
        const first = slotMap[sorted[0]];
        const last = slotMap[sorted[sorted.length - 1]];
        if (first) startTime = first.start;
        if (last) endTime = last.end;
      }

      return {
        id: e.id,
        date: e.date,
        title: e.title,
        eventType: e.event_type,
        visibility: e.visibility,
        location: e.location,
        startTime,
        endTime,
        memo: e.memo,
        description: e.description,
        rooms: linked?.rooms || [],
        slots: linked?.slots || [],
      };
    });

    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Events fetch error:', err);
    return res.status(500).json({ error: 'イベントデータの取得に失敗しました', detail: err?.message || String(err) });
  }
}
