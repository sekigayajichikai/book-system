import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { BookingRequest, RoomType } from '../src/types';
import { sendLineNotification } from '../src/lib/line-notify';

const VALID_ROOMS: RoomType[] = ['会議室', '和室（畳側）', '和室（椅子側）', '図書室'] as RoomType[];

/**
 * POST /api/booking
 *
 * 予約リクエストを受け付け、LINEで事務局に通知する。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const targetId = process.env.LINE_NOTIFY_TARGET_ID;

  if (!token || !targetId) {
    return res.status(500).json({ error: 'Missing LINE env vars' });
  }

  const body = req.body as BookingRequest;

  // バリデーション
  if (!body.date || !body.startTime || !body.endTime || !body.room || !body.name || !body.phone || !body.purpose) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }
  if (!VALID_ROOMS.includes(body.room)) {
    return res.status(400).json({ error: '無効な部屋名です' });
  }

  try {
    await sendLineNotification(token, targetId, body);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('LINE notification error:', err);
    return res.status(502).json({ error: 'LINE通知の送信に失敗しました' });
  }
}
