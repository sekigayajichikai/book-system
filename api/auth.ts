import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/auth
 * 事務局の簡易パスワード認証。
 * 正しければセッショントークン（簡易）を返す。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({ error: 'ADMIN_PASSWORD not configured' });
  }

  if (password === adminPassword) {
    // 簡易トークン（プロトタイプ用。本番ではJWT等に置き換え）
    const token = Buffer.from(`admin:${Date.now()}`).toString('base64');
    return res.status(200).json({ ok: true, role: 'admin', token });
  }

  return res.status(401).json({ error: 'パスワードが正しくありません' });
}
