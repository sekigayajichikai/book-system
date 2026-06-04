import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/import-apply
 *
 * 承認済みのインポート行をbookings/calendar_eventsに反映する。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { batch_id, source_updated_at } = req.body;
  if (!batch_id) {
    return res.status(400).json({ error: 'batch_id is required' });
  }

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

  try {
    // バッチ確認
    const { data: batch, error: batchErr } = await supabase
      .from('import_batches')
      .select('*')
      .eq('id', batch_id)
      .single();

    if (batchErr || !batch) {
      return res.status(404).json({ error: 'バッチが見つかりません' });
    }

    // 承認済み行を取得
    const { data: approvedRows, error: rowsErr } = await supabase
      .from('import_rows')
      .select('*')
      .eq('batch_id', batch_id)
      .eq('review_status', 'approved');

    if (rowsErr) throw rowsErr;

    const rows = approvedRows || [];
    let applied = 0;
    let errors: string[] = [];

    for (const row of rows) {
      try {
        if (row.diff_type === 'add') {
          await applyAdd(supabase, row);
          applied++;
        } else if (row.diff_type === 'update' || row.diff_type === 'title_diff') {
          await applyUpdate(supabase, row);
          applied++;
        } else if (row.diff_type === 'delete') {
          await applyDelete(supabase, row);
          applied++;
        }
      } catch (err: any) {
        errors.push(`${row.date} ${row.slot} ${row.room}: ${err?.message || String(err)}`);
      }
    }

    // バッチステータス更新
    await supabase
      .from('import_batches')
      .update({
        status: 'applied',
        applied_at: new Date().toISOString(),
        source_updated_at: source_updated_at || null,
      })
      .eq('id', batch_id);

    return res.status(200).json({ ok: true, applied, errors: errors.length > 0 ? errors : undefined });
  } catch (err: any) {
    console.error('Import apply error:', err);
    return res.status(500).json({ error: '反映に失敗しました', detail: err?.message });
  }
}

/** 新規追加: calendar_events + bookings INSERT */
async function applyAdd(supabase: any, row: any) {
  // calendar_events に同日同タイトルのイベントがあるか確認
  const { data: existingEvents } = await supabase
    .from('calendar_events')
    .select('id')
    .eq('date', row.date)
    .eq('title', row.title)
    .eq('event_type', 'facility')
    .limit(1);

  let eventId: string;

  if (existingEvents && existingEvents.length > 0) {
    eventId = existingEvents[0].id;
  } else {
    // calendar_events 作成（会館予約由来なので場所は自治会館）
    const { data: newEvent, error: evErr } = await supabase
      .from('calendar_events')
      .insert({
        date: row.date,
        title: row.title,
        event_type: 'facility',
        visibility: 'public',
        location: '自治会館',
      })
      .select()
      .single();

    if (evErr) throw evErr;
    eventId = newEvent.id;
  }

  // bookings INSERT
  const bookingData: any = {
    date: row.date,
    slot: row.slot,
    room: row.room,
    title: row.title,
    status: 'CONFIRMED',
    event_id: eventId,
  };
  if (row.org_id) bookingData.org_id = row.org_id;

  const { error: bookErr } = await supabase
    .from('bookings')
    .insert(bookingData);

  if (bookErr) {
    // ユニーク制約違反は警告のみ
    if (bookErr.code === '23505') {
      console.warn(`Duplicate booking skipped: ${row.date} ${row.slot} ${row.room}`);
      return;
    }
    throw bookErr;
  }
}

/** 変更: bookings UPDATE + calendar_events UPDATE */
async function applyUpdate(supabase: any, row: any) {
  if (!row.existing_booking_id) return;

  // bookings 更新
  const updateData: any = { title: row.title, updated_at: new Date().toISOString() };
  if (row.org_id) updateData.org_id = row.org_id;

  await supabase
    .from('bookings')
    .update(updateData)
    .eq('id', row.existing_booking_id);

  // 紐づくcalendar_events のタイトルも更新（あれば）
  const { data: booking } = await supabase
    .from('bookings')
    .select('event_id')
    .eq('id', row.existing_booking_id)
    .single();

  if (booking?.event_id) {
    await supabase
      .from('calendar_events')
      .update({ title: row.title, updated_at: new Date().toISOString() })
      .eq('id', booking.event_id);
  }
}

/** 削除: bookings DELETE + 孤立したcalendar_eventsも削除 */
async function applyDelete(supabase: any, row: any) {
  if (!row.existing_booking_id) return;

  // 先にevent_idを取得
  const { data: booking } = await supabase
    .from('bookings')
    .select('event_id')
    .eq('id', row.existing_booking_id)
    .single();

  // bookings削除
  await supabase
    .from('bookings')
    .delete()
    .eq('id', row.existing_booking_id);

  // 紐づくcalendar_eventsに他のbookingsが残っていなければ削除
  if (booking?.event_id) {
    const { data: remaining } = await supabase
      .from('bookings')
      .select('id')
      .eq('event_id', booking.event_id)
      .in('status', ['CONFIRMED', 'PENDING'])
      .limit(1);

    if (!remaining || remaining.length === 0) {
      await supabase
        .from('calendar_events')
        .delete()
        .eq('id', booking.event_id);
    }
  }
}
