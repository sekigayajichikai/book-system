import type { VercelRequest, VercelResponse } from '@vercel/node';
import { writeClient } from './_auth.js';
import { verifyOrgToken, orgTokenSecretConfigured } from './_orgToken.js';

/**
 * POST /api/booking
 *
 * Supabase に予約を保存する。
 *
 * ここは団体が予約を申し込む窓口なので、事務局のログインは求めない。
 * 代わりに、団体ログインの通行証（署名付き）を確かめる。
 * 行単位の保護（RLS）を入れたあとも書けるよう、強い鍵で書き込む。
 *
 * ORG_TOKEN_SECRET が未設定のあいだは、署名のない古い通行証も受け付ける（移行のため）。
 * 鍵を設定すると偽造できなくなり、団体は一度入り直しになる。
 * 詳細は CC-SaaS の docs/セキュリティ-RLS.md。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 団体の通行証を確かめる（ヘッダー優先、無ければ本文の org_token）
  const header = (req.headers.authorization || '') as string;
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : req.body?.org_token;
  const org = verifyOrgToken(token);
  if (!org) {
    return res.status(401).json({ error: '団体としてログインしてから申し込んでください' });
  }
  if (!orgTokenSecretConfigured()) {
    console.warn('[警告] ORG_TOKEN_SECRET が未設定です。通行証の署名を確かめられません。');
  }

  const body = req.body;

  if (!body.date || !body.slot || !body.room || !body.title) {
    return res.status(400).json({ error: '必須項目が不足しています (date, slot, room, title)' });
  }

  try {
    const supabase = writeClient();
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
        event_id: body.event_id || null,
        // Web の申込だと記録する（会館の Excel 取込で「Excelに無い」として消されないように）
        created_by: 'web',
        // 誰の申し込みかは、画面から来た値ではなく通行証の中身を使う
        org_id: org.org_id,
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
