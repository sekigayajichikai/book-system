import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabase } from './_supabase';

/**
 * POST /api/booking
 *
 * Supabase に予約を保存する。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body;

  if (!body.date || !body.slot || !body.room || !body.title) {
    return res.status(400).json({ error: '必須項目が不足しています (date, slot, room, title)' });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        date: body.date,
        slot: body.slot,
        room: body.room,
        title: body.title,
        status: body.status || 'CONFIRMED',
        category: body.category || null,
        equipment: body.equipment || [],
        price: body.price || 0,
        memo: body.memo || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'この時間帯・部屋は既に予約されています' });
      }
      throw error;
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Supabase booking save error:', err);
    return res.status(500).json({ error: '予約の保存に失敗しました' });
  }
}
