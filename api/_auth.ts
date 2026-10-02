/**
 * 窓口（api/）の認証と、書き込み用のクライアント
 *
 * これまで api/ の書き込み7本は認証が一切なく、誰でも外から叩けた。
 * 発行していたトークンは base64 で署名が無く、検証もしていなかった。
 *
 * 2026-10-02 から、事務局が使う窓口は Supabase Auth の証明書を確かめる。
 * 画面側は src/lib/apiFetch.ts の apiFetch を通して呼ぶこと（証明書が自動で付く）。
 *
 * 書き込みには強い鍵（service_role）を使う。これはサーバー側だけに置き、
 * ブラウザには出さない。行単位の保護（RLS）を入れたあとも窓口が動くために必要。
 * 未設定のあいだは公開鍵で動く（いまは RLS が無いので動くが、入れると止まる）。
 *
 * 詳細は CC-SaaS の docs/セキュリティ-RLS.md。
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * 事務局がログインしているかを確かめる。
 * していなければ 401 を返して false を返すので、呼び出し側はそのまま return する。
 */
export async function requireAdmin(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  const header = (req.headers.authorization || '') as string;
  const jwt = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!jwt) {
    res.status(401).json({ error: 'ログインが必要です' });
    return false;
  }
  try {
    const supabase = createClient(SUPABASE_URL, ANON_KEY);
    const { data, error } = await supabase.auth.getUser(jwt);
    if (error || !data?.user) {
      res.status(401).json({ error: 'ログインが必要です' });
      return false;
    }
    return true;
  } catch {
    res.status(401).json({ error: 'ログインが必要です' });
    return false;
  }
}

/**
 * 書き込み用のクライアント。
 * 強い鍵があればそれを使い、無ければ公開鍵で動く（警告だけ出す）。
 */
export function writeClient() {
  if (SERVICE_KEY) return createClient(SUPABASE_URL, SERVICE_KEY);
  console.warn(
    '[警告] SUPABASE_SERVICE_ROLE_KEY が未設定です。公開鍵で動きます。' +
      '行単位の保護（RLS）を入れると、この窓口は書けなくなります。'
  );
  return createClient(SUPABASE_URL, ANON_KEY);
}

/** 読み取りだけのクライアント（公開鍵でよい） */
export function readClient() {
  return createClient(SUPABASE_URL, ANON_KEY);
}
