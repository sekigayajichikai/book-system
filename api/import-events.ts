import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * /api/import-events
 *
 * デジタル回覧板アプリが抽出した予定候補の受付と承認反映。
 *
 * POST:  候補行の受付（回覧板アプリからの自動送信 or 管理画面のJSON貼り付け）
 *        body: { api_key, rows: [{ date, title, location?, start_time?, end_time?, article_url? }] }
 * GET:   管理画面用の候補一覧（pending のみ、既存イベントとの重複判定付き）
 * PATCH: 候補の承認/却下
 *        body: { ids: string[], action: 'apply' | 'reject' }
 *        apply は calendar_events(event_type=general) へ登録して applied にする
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

  if (req.method === 'POST') return handlePost(req, res, supabase);
  if (req.method === 'GET') return handleGet(req, res, supabase);
  if (req.method === 'PATCH') return handlePatch(req, res, supabase);
  return res.status(405).json({ error: 'Method not allowed' });
}

interface CandidateRow {
  date: string;
  title: string;
  location?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  article_url?: string | null;
}

/** 候補行のバリデーション（date必須 YYYY-MM-DD、title必須） */
function sanitizeRow(row: any): CandidateRow | null {
  if (!row || typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return null;
  if (typeof row.title !== 'string' || !row.title.trim()) return null;
  const str = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    date: row.date,
    title: row.title.trim().slice(0, 100),
    location: str(row.location),
    start_time: str(row.start_time),
    end_time: str(row.end_time),
    article_url: str(row.article_url),
  };
}

/** POST: 候補受付 */
async function handlePost(req: VercelRequest, res: VercelResponse, supabase: any) {
  const { api_key, rows } = req.body || {};

  // 認証（回覧板アプリからのAPIキー or 管理画面からの貼り付け）
  if (api_key !== process.env.IMPORT_API_KEY && api_key !== 'browser-upload') {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'rows are required' });
  }
  if (rows.length > 200) {
    return res.status(400).json({ error: 'rows が多すぎます（最大200件）' });
  }

  const valid: CandidateRow[] = [];
  for (const raw of rows) {
    const row = sanitizeRow(raw);
    if (row) valid.push(row);
  }
  if (valid.length === 0) {
    return res.status(400).json({ error: '有効な行がありません（date: YYYY-MM-DD と title が必須）' });
  }

  try {
    // 既にpendingの同一候補（日付+タイトル）はスキップ
    const dates = [...new Set(valid.map(r => r.date))];
    const { data: pending } = await supabase
      .from('general_import_rows')
      .select('date, title')
      .eq('status', 'pending')
      .in('date', dates);
    const pendingSet = new Set((pending || []).map((r: any) => `${r.date}|${r.title}`));

    const seen = new Set<string>();
    const toInsert = valid.filter(r => {
      const key = `${r.date}|${r.title}`;
      if (pendingSet.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (toInsert.length > 0) {
      const { error } = await supabase.from('general_import_rows').insert(toInsert);
      if (error) throw error;
    }

    return res.status(200).json({
      ok: true,
      added: toInsert.length,
      skipped: valid.length - toInsert.length,
      invalid: rows.length - valid.length,
    });
  } catch (err: any) {
    console.error('import-events POST error:', err);
    return res.status(500).json({ error: '候補の受付に失敗しました', detail: err?.message });
  }
}

/** GET: pending候補一覧 + 既存カレンダーとの重複判定 */
async function handleGet(_req: VercelRequest, res: VercelResponse, supabase: any) {
  try {
    const { data: rows, error } = await supabase
      .from('general_import_rows')
      .select('*')
      .eq('status', 'pending')
      .order('date')
      .order('created_at');
    if (error) throw error;

    // 既存の general イベントとの重複判定（日付+タイトル一致）
    let duplicateKeys = new Set<string>();
    if (rows && rows.length > 0) {
      const dates = [...new Set(rows.map((r: any) => r.date))];
      const { data: existing } = await supabase
        .from('calendar_events')
        .select('date, title')
        .eq('event_type', 'general')
        .in('date', dates);
      duplicateKeys = new Set((existing || []).map((e: any) => `${e.date}|${e.title}`));
    }

    const result = (rows || []).map((r: any) => ({
      ...r,
      is_duplicate: duplicateKeys.has(`${r.date}|${r.title}`),
    }));

    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).json({ rows: result });
  } catch (err: any) {
    console.error('import-events GET error:', err);
    return res.status(500).json({ error: '候補一覧の取得に失敗しました', detail: err?.message });
  }
}

/** PATCH: 承認（calendar_eventsへ登録）/ 却下 */
async function handlePatch(req: VercelRequest, res: VercelResponse, supabase: any) {
  const { ids, action } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0 || !['apply', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'ids と action(apply/reject) が必要です' });
  }

  try {
    if (action === 'reject') {
      const { error } = await supabase
        .from('general_import_rows')
        .update({ status: 'rejected' })
        .in('id', ids)
        .eq('status', 'pending');
      if (error) throw error;
      return res.status(200).json({ ok: true, rejected: ids.length });
    }

    // apply: 1件ずつ calendar_events へ登録して applied に更新
    const { data: rows, error: fetchErr } = await supabase
      .from('general_import_rows')
      .select('*')
      .in('id', ids)
      .eq('status', 'pending');
    if (fetchErr) throw fetchErr;

    let applied = 0;
    const errors: string[] = [];
    for (const row of rows || []) {
      const { data: event, error: insErr } = await supabase
        .from('calendar_events')
        .insert({
          date: row.date,
          title: row.title,
          location: row.location,
          start_time: row.start_time,
          end_time: row.end_time,
          article_url: row.article_url,
          event_type: 'general',
          visibility: 'public',
        })
        .select('id')
        .single();

      if (insErr) {
        errors.push(`${row.date} ${row.title}: ${insErr.message}`);
        continue;
      }

      await supabase
        .from('general_import_rows')
        .update({ status: 'applied', applied_event_id: event.id })
        .eq('id', row.id);
      applied++;
    }

    return res.status(200).json({ ok: errors.length === 0, applied, errors });
  } catch (err: any) {
    console.error('import-events PATCH error:', err);
    return res.status(500).json({ error: '候補の反映に失敗しました', detail: err?.message });
  }
}
