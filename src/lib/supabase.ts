/**
 * Supabase への入口（画面側で共有する1つのクライアント）
 *
 * これまで各コンポーネントが公開鍵を直接ヘッダに入れて PostgREST を叩いていたため、
 * 管理画面の書き込みも「公開鍵の人」として届いていた。データベース側では
 * 管理者か住民かを見分けられず、行単位の保護（RLS）をかけられない状態だった。
 *
 * ここで作るクライアントがログイン状態を持つので、ログイン後の読み書きは
 * 自動的に「ログイン済みの人」として届く。
 * 直接 fetch する場合も、下の supaFetch / supaPatch を通せば同じ扱いになる。
 *
 * 管理者アカウントは回覧板ポータルと共通（同じ Supabase プロジェクト）。
 * 詳細は CC-SaaS の docs/セキュリティ-RLS.md。
 */

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * 管理者アカウントのメールアドレス。
 * ログイン画面にメール欄を出さないので、ここで決めたものを使う。
 * 回覧板ポータルと同じアカウント。別のアドレスなら VITE_ADMIN_EMAIL で上書きできる。
 */
export const ADMIN_EMAIL: string =
  import.meta.env.VITE_ADMIN_EMAIL || 'sekigaya.dx@gmail.com';

/** ログイン済みならその証明書を、そうでなければ公開鍵を使うヘッダ */
export async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  let token = SUPABASE_ANON_KEY;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) token = data.session.access_token;
  } catch {
    // 取れなければ公開鍵のまま（読み取りは通る）
  }
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(extra || {}),
  };
}

/** PostgREST を叩く（ログイン済みならその資格で） */
export async function supaFetch(path: string, options?: RequestInit): Promise<Response> {
  const headers = await authHeaders({
    Prefer: 'return=representation',
    ...((options?.headers as Record<string, string>) || {}),
  });
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers });
}

/** 書き込みが通らなかったとき（status 0 = 通信できなかった） */
export class WriteError extends Error {
  constructor(public status: number, public body: string) {
    super(`書き込みに失敗しました (${status})`);
  }
}

/**
 * 書き込み用の supaFetch。失敗したら WriteError を投げる。
 *
 * 以前は管理画面の承認・保存・削除の多くが結果を見ておらず、
 * 断られても画面上は成功したように見えていた。
 * 権限（RLS）で弾かれた PATCH は 200 と空配列で返るので、それも失敗として扱う。
 */
export async function supaWrite(path: string, options: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await supaFetch(path, options);
  } catch {
    throw new WriteError(0, '');
  }
  if (!res.ok) throw new WriteError(res.status, await res.text().catch(() => ''));
  if (options.method === 'PATCH') {
    const rows = await res.clone().json().catch(() => null);
    if (Array.isArray(rows) && rows.length === 0) throw new WriteError(403, 'no rows updated');
  }
  return res;
}

/** 書き込み失敗を、次に何をすればよいかが分かる文に直す */
export function writeErrorMessage(e: unknown): string {
  if (e instanceof WriteError) {
    if (e.body.includes('23505')) return 'この時間帯・部屋は既に予約されています。';
    if (e.status === 0) return '通信できませんでした。インターネット接続を確かめて、もう一度お試しください。';
    if (e.status === 401 || e.status === 403) {
      return 'ログインが切れたか、変更する権限がありません。ログインし直してから、もう一度お試しください。';
    }
  }
  return '保存できませんでした。時間をおいて、もう一度お試しください。';
}

/** 1件だけ書き換える（戻り値は使わないことが多いので return=minimal） */
export async function supaPatch(path: string, body: unknown): Promise<Response> {
  const headers = await authHeaders({ Prefer: 'return=minimal' });
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

/** データベースの関数を呼ぶ（パスコードのように直接は読み書きさせない項目に使う） */
export async function supaRpc(fn: string, args: Record<string, unknown>): Promise<any> {
  const res = await supaFetch(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });
  if (!res.ok) throw new Error(`${fn} に失敗しました (${res.status})`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

/** いまログインしているか */
export async function isLoggedIn(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  } catch {
    return false;
  }
}
