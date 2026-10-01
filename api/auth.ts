import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/auth
 * type: 'admin' → 事務局パスワード認証
 * type: 'org'   → 団体名+パスコード認証
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, password, org_name, passcode } = req.body;

  // === 事務局認証 ===
  if (type === 'admin' || (!type && password)) {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) return res.status(500).json({ error: 'ADMIN_PASSWORD not configured' });

    if (password === adminPassword) {
      const token = Buffer.from(JSON.stringify({ role: 'admin', t: Date.now() })).toString('base64');
      return res.status(200).json({ ok: true, role: 'admin', token });
    }
    return res.status(401).json({ error: 'パスワードが正しくありません' });
  }

  // === 団体認証 ===
  if (type === 'org') {
    if (!org_name || !passcode) {
      return res.status(400).json({ error: '団体名とパスコードを入力してください' });
    }

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

    // パスコードは booking_org_secrets に隔離してあり、公開鍵では読めない。
    // 照合は中だけ特権で動く関数に任せ、合っていれば団体の情報だけが返る。
    // （団体名が存在するかどうかも答えないよう、エラーの文言は1つにまとめている）
    const { data: rows, error } = await supabase.rpc('verify_org_passcode', {
      p_org_name: org_name,
      p_passcode: passcode,
    });

    const org = Array.isArray(rows) ? rows[0] : rows;
    if (error || !org) {
      return res.status(401).json({ error: '団体名またはパスコードが正しくありません' });
    }

    const token = Buffer.from(JSON.stringify({
      role: 'org', org_id: org.id, org_name: org.name, category: org.category, t: Date.now(),
    })).toString('base64');

    return res.status(200).json({ ok: true, role: 'org', token, org_id: org.id, org_name: org.name });
  }

  return res.status(400).json({ error: 'type パラメータが必要です (admin or org)' });
}
