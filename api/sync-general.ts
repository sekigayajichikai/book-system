import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/sync-general
 *
 * Googleスプレッドシートから「一般」予定を一括インポート。
 * シート1行 = 1つの calendar_event (event_type='general')
 *
 * 列: A=日付, B=タイトル, C=場所, D=開始, E=終了, F=主な予定(○), G=メモ, H=休館(○)
 */

const SHEET_ID = process.env.GENERAL_SHEET_ID || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sheetId = req.body?.sheet_id || SHEET_ID;
  if (!sheetId) {
    return res.status(400).json({ error: 'スプレッドシートIDが設定されていません' });
  }

  try {
    // GoogleスプレッドシートからCSv取得
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
    let csvRes = await fetch(csvUrl, { redirect: 'manual' });
    if (csvRes.status === 307 || csvRes.status === 302 || csvRes.status === 301) {
      const redirectUrl = csvRes.headers.get('location');
      if (redirectUrl) csvRes = await fetch(redirectUrl);
    }

    if (!csvRes.ok) {
      return res.status(502).json({
        error: 'スプレッドシートの取得に失敗しました',
        detail: `HTTP ${csvRes.status}`,
      });
    }

    const csvText = await csvRes.text();
    const rows = parseCSV(csvText);

    if (rows.length === 0) {
      return res.status(200).json({ ok: true, imported: 0, skipped: 0 });
    }

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

    // 既存のgeneral eventsを取得（重複チェック用）
    const dates = [...new Set(rows.map(r => r.date))];
    const { data: existing } = await supabase
      .from('calendar_events')
      .select('id, date, title')
      .eq('event_type', 'general')
      .in('date', dates);

    const existingSet = new Set(
      (existing || []).map(e => `${e.date}|${e.title}`)
    );

    // 休館日と一般イベントを分離
    const closureRows = rows.filter(r => r.is_closure);
    const eventRows = rows.filter(r => !r.is_closure);

    // --- 休館日の処理 ---
    let closuresImported = 0;
    for (const row of closureRows) {
      // 既存の休館日チェック
      const { data: existClosure } = await supabase
        .from('calendar_events')
        .select('id')
        .eq('date', row.date)
        .eq('is_closure', true)
        .limit(1);

      if (!existClosure || existClosure.length === 0) {
        await supabase
          .from('calendar_events')
          .insert({
            date: row.date,
            title: row.title || '休館日',
            is_closure: true,
            event_type: 'closure',
            visibility: 'public',
          });
        closuresImported++;
      }
    }

    // --- 一般イベントの処理 ---
    const newRows = eventRows.filter(r => !existingSet.has(`${r.date}|${r.title}`));
    let imported = 0;

    for (const row of newRows) {
      const { error } = await supabase
        .from('calendar_events')
        .insert({
          date: row.date,
          title: row.title,
          location: row.location || null,
          start_time: row.start_time || null,
          end_time: row.end_time || null,
          is_major: row.is_major,
          org_name: row.memo || null,
          event_type: 'general',
          visibility: 'public',
        });

      if (!error) imported++;
    }

    // 既存データの更新（日付+タイトルが一致するものは更新）
    const updateRows = eventRows.filter(r => existingSet.has(`${r.date}|${r.title}`));
    let updated = 0;

    for (const row of updateRows) {
      const match = (existing || []).find(e => e.date === row.date && e.title === row.title);
      if (!match) continue;

      await supabase
        .from('calendar_events')
        .update({
          location: row.location || null,
          start_time: row.start_time || null,
          end_time: row.end_time || null,
          is_major: row.is_major,
          org_name: row.memo || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', match.id);

      updated++;
    }

    return res.status(200).json({
      ok: true,
      total: rows.length,
      imported,
      updated,
      closures: closuresImported,
      skipped: rows.length - imported - updated - closuresImported,
    });
  } catch (err: any) {
    console.error('sync-general error:', err);
    return res.status(500).json({ error: '取込に失敗しました', detail: err?.message });
  }
}

interface ParsedRow {
  date: string;
  title: string;
  location: string;
  start_time: string;
  end_time: string;
  is_major: boolean;
  memo: string;
  is_closure: boolean;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split('\n');
  const rows: ParsedRow[] = [];

  // 1行目はヘッダー、スキップ
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 2) continue;

    const date = cols[0]?.trim().replace(/"/g, '');
    const title = cols[1]?.trim().replace(/"/g, '');
    if (!date || !title) continue;

    // 日付バリデーション
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    rows.push({
      date,
      title,
      location: cols[2]?.trim().replace(/"/g, '') || '',
      start_time: normalizeTime(cols[3]?.trim().replace(/"/g, '') || ''),
      end_time: normalizeTime(cols[4]?.trim().replace(/"/g, '') || ''),
      is_major: (cols[5]?.trim().replace(/"/g, '') || '') === '○',
      memo: cols[6]?.trim().replace(/"/g, '') || '',
      is_closure: (cols[7]?.trim().replace(/"/g, '') || '') === '○',
    });
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function normalizeTime(val: string): string {
  if (!val) return '';
  // HH:MM形式に正規化
  const m = val.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return '';
}
