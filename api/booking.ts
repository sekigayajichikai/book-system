import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/booking
 *
 * GAS Web App 経由でスプレッドシートの確定シートに予約を保存する。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gasUrl = process.env.GAS_WEBAPP_URL;
  if (!gasUrl) {
    return res.status(500).json({ error: 'Missing GAS_WEBAPP_URL' });
  }

  const body = req.body;

  // バリデーション
  if (!body.date || !body.slot || !body.room || !body.title) {
    return res.status(400).json({ error: '必須項目が不足しています (date, slot, room, title)' });
  }

  // 日付をパース
  const dateParts = String(body.date).split('-');
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10);
  const day = parseInt(dateParts[2], 10);

  try {
    const gasRes = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save',
        year,
        month,
        day,
        slot: body.slot,
        room: body.room,
        title: body.title,
        org: body.org || '',
      }),
      redirect: 'follow',
    });

    if (!gasRes.ok) throw new Error(`GAS API error ${gasRes.status}`);
    const result = await gasRes.json();
    return res.status(200).json(result);
  } catch (err) {
    console.error('GAS API save error:', err);
    return res.status(502).json({ error: 'スプレッドシートへの保存に失敗しました' });
  }
}
