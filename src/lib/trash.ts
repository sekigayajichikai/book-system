/**
 * ゴミ箱（削除したものの控え）
 *
 * 予定・予約を消す直前に中身を trash_items へ控える。
 * 元に戻すのは回覧板ポータルの管理画面「ゴミ箱」から（同じ Supabase の同じテーブル）。
 * テーブル定義は CC-SaaS の sql/migrations/2026-10-02-trash-items.sql。
 */

import { supaFetch, supaWrite, WriteError } from './supabase';

export interface TrashPart {
  table: string;
  rows: Record<string, unknown>[];
}

/** 控え用に行を読む */
export async function fetchRows(table: string, filter: string): Promise<Record<string, unknown>[]> {
  const res = await supaFetch(`${table}?${filter}&select=*`);
  if (!res.ok) throw new WriteError(res.status, await res.text().catch(() => ''));
  return res.json();
}

/**
 * 削除の直前に控えを取る。取れなければ例外にして削除を止める。
 * ただしテーブルがまだ無い（SQL 未実行）ときは、従来どおり削除できるよう何もしない。
 */
export async function saveToTrash(
  kind: 'calendar_event' | 'booking',
  label: string,
  payload: TrashPart[]
): Promise<void> {
  if (payload.every(p => p.rows.length === 0)) return;
  try {
    await supaWrite('trash_items', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ kind, label, payload, source: 'calendar' }),
    });
  } catch (e) {
    if (e instanceof WriteError && (e.status === 404 || /PGRST205|42P01|trash_items/.test(e.body))) {
      console.warn('ゴミ箱のテーブルがまだ無いため、控えを取らずに削除します');
      return;
    }
    throw e;
  }
}
