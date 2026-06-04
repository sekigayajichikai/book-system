import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createOrgMatcher } from './lib/match-org';

/**
 * /api/import
 *
 * POST: PC側スクリプトからステージングデータ受付 + 差分計算
 * GET:  管理画面用の差分一覧取得
 * PATCH: 行ごとのレビューステータス更新
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

  if (req.method === 'POST') return handlePost(req, res, supabase);
  if (req.method === 'GET') return handleGet(req, res, supabase);
  if (req.method === 'PATCH') return handlePatch(req, res, supabase);
  if (req.method === 'DELETE') return handleDelete(req, res, supabase);
  return res.status(405).json({ error: 'Method not allowed' });
}

/** POST: ステージングデータ受付 + 差分計算 */
async function handlePost(req: VercelRequest, res: VercelResponse, supabase: any) {
  const { api_key, year, month, source_hash, source_updated_at, rows } = req.body;

  // 認証（API keyまたはブラウザアップロード）
  if (api_key !== process.env.IMPORT_API_KEY && api_key !== 'browser-upload') {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  if (!year || !month || !rows || !Array.isArray(rows)) {
    return res.status(400).json({ error: 'year, month, rows are required' });
  }

  try {
    // 同一年月の既存pending/reviewingバッチを削除（CASCADEでrowsも消える）
    await supabase
      .from('import_batches')
      .delete()
      .eq('target_year', year)
      .eq('target_month', month)
      .in('status', ['pending', 'reviewing']);

    // 新バッチ作成
    const { data: batch, error: batchErr } = await supabase
      .from('import_batches')
      .insert({
        target_year: year,
        target_month: month,
        source_hash: source_hash || null,
        source_updated_at: source_updated_at || null,
        total_rows: rows.length,
      })
      .select()
      .single();

    if (batchErr) throw batchErr;

    // 対象月の既存bookings取得
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('id, date, slot, room, title')
      .gte('date', startDate)
      .lt('date', endDate)
      .in('status', ['CONFIRMED', 'PENDING']);

    // 既存bookingsをキーでマップ化
    const existingMap: Record<string, { id: string; title: string }> = {};
    (existingBookings || []).forEach((b: any) => {
      const key = `${b.date}|${b.slot}|${b.room}`;
      existingMap[key] = { id: b.id, title: b.title };
    });

    // 団体自動マッチ
    const matchOrgId = await createOrgMatcher(supabase);

    // インポート行のキーセット（delete検出用）
    const importKeySet = new Set<string>();

    // 差分計算
    const importRows: any[] = [];
    const stats = { add: 0, update: 0, title_diff: 0, delete: 0, skip: 0 };

    for (const row of rows) {
      const key = `${row.date}|${row.slot}|${row.room}`;
      importKeySet.add(key);

      const existing = existingMap[key];

      // 「予約あり」はスキップ
      if (row.title === '予約あり') {
        stats.skip++;
        importRows.push({
          batch_id: batch.id,
          date: row.date,
          slot: row.slot,
          room: row.room,
          title: row.title,
          org_guess: row.org_guess || null,
          org_id: matchOrgId(row.title),
          diff_type: 'skip',
          existing_booking_id: existing?.id || null,
          existing_title: existing?.title || null,
          review_status: 'skipped',
        });
        continue;
      }

      if (existing) {
        if (existing.title === row.title) {
          // 変更なし
          stats.skip++;
          importRows.push({
            batch_id: batch.id,
            date: row.date,
            slot: row.slot,
            room: row.room,
            title: row.title,
            org_guess: row.org_guess || null,
            diff_type: 'skip',
            existing_booking_id: existing.id,
            existing_title: existing.title,
            review_status: 'skipped',
          });
        } else {
          // タイトル差異（デフォルトskip、手動承認で上書き可能）
          stats.title_diff++;
          importRows.push({
            batch_id: batch.id,
            date: row.date,
            slot: row.slot,
            room: row.room,
            title: row.title,
            org_guess: row.org_guess || null,
            org_id: matchOrgId(row.title),
            diff_type: 'title_diff',
            existing_booking_id: existing.id,
            existing_title: existing.title,
            review_status: 'skipped',
          });
        }
      } else {
        // 新規
        stats.add++;
        importRows.push({
          batch_id: batch.id,
          date: row.date,
          slot: row.slot,
          room: row.room,
          title: row.title,
          org_guess: row.org_guess || null,
          org_id: matchOrgId(row.title),
          diff_type: 'add',
          review_status: 'pending',
        });
      }
    }

    // 削除検出: bookingsにあるがExcelにない（「予約あり」は除外）
    for (const [key, existing] of Object.entries(existingMap)) {
      if (!importKeySet.has(key) && existing.title !== '予約あり') {
        const [date, slot, room] = key.split('|');
        stats.delete++;
        importRows.push({
          batch_id: batch.id,
          date,
          slot,
          room,
          title: existing.title,
          org_id: matchOrgId(existing.title),
          diff_type: 'delete',
          existing_booking_id: existing.id,
          existing_title: existing.title,
          review_status: 'pending',
        });
      }
    }

    // import_rows 一括INSERT
    if (importRows.length > 0) {
      const { error: rowsErr } = await supabase
        .from('import_rows')
        .insert(importRows);
      if (rowsErr) throw rowsErr;
    }

    // バッチstats更新
    await supabase
      .from('import_batches')
      .update({ stats, total_rows: importRows.length })
      .eq('id', batch.id);

    return res.status(200).json({ ok: true, batch_id: batch.id, stats });
  } catch (err: any) {
    console.error('Import error:', err);
    return res.status(500).json({ error: 'インポートに失敗しました', detail: err?.message });
  }
}

/** GET: 差分一覧取得（全バッチ対応） */
async function handleGet(req: VercelRequest, res: VercelResponse, supabase: any) {
  const { include_skip } = req.query;

  try {
    // pending/reviewing の全バッチ取得
    const { data: batches, error: batchErr } = await supabase
      .from('import_batches')
      .select('*')
      .in('status', ['pending', 'reviewing'])
      .order('target_year')
      .order('target_month');

    if (batchErr) throw batchErr;

    if (!batches || batches.length === 0) {
      return res.status(200).json({ batches: [], rows: [] });
    }

    // 全バッチのIDで行を一括取得
    const batchIds = batches.map((b: any) => b.id);
    let rowsQuery = supabase
      .from('import_rows')
      .select('*')
      .in('batch_id', batchIds)
      .order('date')
      .order('slot')
      .order('room');

    if (include_skip !== 'true') {
      rowsQuery = rowsQuery.neq('diff_type', 'skip');
    }

    const { data: rows, error: rowsErr } = await rowsQuery;
    if (rowsErr) throw rowsErr;

    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).json({ batches, rows: rows || [] });
  } catch (err: any) {
    console.error('Import GET error:', err);
    return res.status(500).json({ error: '取得に失敗しました', detail: err?.message });
  }
}

/** PATCH: レビューステータス更新 */
async function handlePatch(req: VercelRequest, res: VercelResponse, supabase: any) {
  const { rows } = req.body;

  if (!rows || !Array.isArray(rows)) {
    return res.status(400).json({ error: 'rows array is required' });
  }

  try {
    for (const row of rows) {
      const update: any = {};
      if (row.review_status !== undefined) update.review_status = row.review_status;
      if (row.review_note !== undefined) update.review_note = row.review_note;
      if (row.title !== undefined) update.title = row.title;
      if (row.org_id !== undefined) update.org_id = row.org_id;

      await supabase
        .from('import_rows')
        .update(update)
        .eq('id', row.id);
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Import PATCH error:', err);
    return res.status(500).json({ error: '更新に失敗しました', detail: err?.message });
  }
}

/** DELETE: pending/reviewingの全バッチを削除（CASCADEでrowsも消える） */
async function handleDelete(_req: VercelRequest, res: VercelResponse, supabase: any) {
  try {
    const { error } = await supabase
      .from('import_batches')
      .delete()
      .in('status', ['pending', 'reviewing']);

    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Import DELETE error:', err);
    return res.status(500).json({ error: '削除に失敗しました', detail: err?.message });
  }
}
