/**
 * 窓口（/api/...）を呼ぶときの入口
 *
 * 事務局が使う窓口は、ログインしている証明書を見て受け付けるようになった。
 * ここを通せば証明書が自動で付く。ログインしていなければ付かないので、
 * 窓口側が 401 を返す。
 */

import { supabase } from './supabase';

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  let token: string | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token ?? null;
  } catch {
    // 取れなければ付けない（窓口側で断られる）
  }
  return fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options?.headers as Record<string, string>) || {}),
    },
  });
}
