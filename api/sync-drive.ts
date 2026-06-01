import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

/**
 * POST /api/sync-drive
 *
 * Google DriveからExcelファイルを取得→パース→差分計算→ステージング保存
 * ImportTabの「Googleドライブから取込」ボタンまたはVercel Cronから呼ばれる。
 */

const DRIVE_FILE_ID = process.env.DRIVE_FILE_ID || '1nHObS6maUplrjd-HkHzRTYGe7FVcUMYc';

// ORG_MAP（団体推測用）
const ORG_MAP: Record<string, string> = {
  '囲碁': '自主活動部', 'カラオケ': '自主活動部', '関ヶ谷クラブ': '自主活動部',
  'ディスクコンサート': '自主活動部', '図書': '自主活動部', 'ふれあい': '自主活動部',
  'ブルーベル': '自主活動部', 'ブル―ベル': '自主活動部', 'トーンチャイム': '自主活動部',
  'ちりとてちん': '自主活動部', 'オペラ': '自主活動部', '読書': '自主活動部',
  'つなぎの会': '自主活動部', 'ききょう': '自主活動部', '見まわり隊': '自主活動部',
  '役員': '役員', '総会': '役員', '新役員': '役員',
  '事務局': '事務局', '会館予約': '事務局', '会計監査': '事務局',
  '防災': '委員会', 'HP': '委員会', 'DX': '委員会', '環境': '委員会',
  '広報': '委員会', '青少年': '委員会',
  '地区長': '地区長・班長', '班長': '地区長・班長', '合同会議': '地区長・班長',
};

function guessOrg(title: string): string {
  for (const [kw, org] of Object.entries(ORG_MAP)) {
    if (title.includes(kw)) return org;
  }
  return '';
}

// 行定義（0-indexed row）
const ROWS_DEF: [number, string, string][] = [
  [3, '午前', '会議室'], [4, '午前', '和室（畳側）'],
  [5, '午前', '和室（椅子側）'], [6, '午前', '図書室'],
  [8, '午後', '会議室'], [9, '午後', '和室（畳側）'],
  [10, '午後', '和室（椅子側）'], [11, '午後', '図書室'],
  [12, '夜間', '会議室'],
];

interface ParsedMonth {
  year: number;
  month: number;
  rows: { date: string; slot: string; room: string; title: string; org_guess: string }[];
}

function parseWorkbook(buffer: ArrayBuffer): ParsedMonth[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const results: ParsedMonth[] = [];

  const now = new Date();
  const minYM = now.getFullYear() * 12 + now.getMonth();
  const maxYM = minYM + 12;

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws['I1'] || !ws['L1']) continue;
    const year = Number(ws['I1'].v);
    const month = Number(ws['L1'].v);
    if (!(year >= 2020 && year <= 2099 && month >= 1 && month <= 12)) continue;

    const ym = year * 12 + (month - 1);
    if (ym < minYM || ym > maxYM) continue;

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    const dateCols: { col: number; day: number }[] = [];
    for (let c = 0; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 1, c })];
      if (cell && cell.t === 'n' && cell.v > 40000) {
        const d = XLSX.SSF.parse_date_code(cell.v);
        if (d.m === month) dateCols.push({ col: c, day: d.d });
      }
    }

    const rows: ParsedMonth['rows'] = [];
    for (const [rowIdx, slot, room] of ROWS_DEF) {
      for (const { col, day } of dateCols) {
        const cell = ws[XLSX.utils.encode_cell({ r: rowIdx, c: col })];
        if (!cell || !cell.v) continue;
        const title = String(cell.v).trim().replace(/\u3000/g, '');
        if (!title || title === '×') continue;
        rows.push({
          date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          slot, room, title,
          org_guess: guessOrg(title),
        });
      }
    }

    if (rows.length > 0) results.push({ year, month, rows });
  }

  return results;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Google DriveからExcelをダウンロード
    const exportUrl = `https://docs.google.com/spreadsheets/d/${DRIVE_FILE_ID}/export?format=xlsx`;
    const dlRes = await fetch(exportUrl);
    if (!dlRes.ok) {
      return res.status(502).json({
        error: 'Googleドライブからのダウンロードに失敗しました',
        detail: `HTTP ${dlRes.status}: ${dlRes.statusText}`,
      });
    }

    const buffer = await dlRes.arrayBuffer();
    const parsed = parseWorkbook(buffer);

    if (parsed.length === 0) {
      return res.status(200).json({ ok: true, months: 0, stats: { add: 0, update: 0, delete: 0, skip: 0 } });
    }

    // 各月ごとに /api/import と同じ差分計算を実行
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    const totalStats = { add: 0, update: 0, delete: 0, skip: 0 };

    for (const { year, month, rows } of parsed) {
      const result = await processMonth(supabase, year, month, rows);
      totalStats.add += result.add;
      totalStats.update += result.update;
      totalStats.delete += result.delete;
      totalStats.skip += result.skip;
    }

    return res.status(200).json({ ok: true, months: parsed.length, stats: totalStats });
  } catch (err: any) {
    console.error('sync-drive error:', err);
    return res.status(500).json({ error: '同期に失敗しました', detail: err?.message });
  }
}

/** 1ヶ月分の差分計算+ステージング保存（import.ts handlePostと同じロジック） */
async function processMonth(supabase: any, year: number, month: number, rows: ParsedMonth['rows']) {
  const stats = { add: 0, update: 0, delete: 0, skip: 0 };

  // 既存pendingバッチ削除
  await supabase
    .from('import_batches')
    .delete()
    .eq('target_year', year)
    .eq('target_month', month)
    .in('status', ['pending', 'reviewing']);

  // バッチ作成
  const { data: batch, error: batchErr } = await supabase
    .from('import_batches')
    .insert({ target_year: year, target_month: month, source_file: 'Google Drive', total_rows: rows.length })
    .select()
    .single();

  if (batchErr) throw batchErr;

  // 既存bookings取得
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

  const existingMap: Record<string, { id: string; title: string }> = {};
  (existingBookings || []).forEach((b: any) => {
    existingMap[`${b.date}|${b.slot}|${b.room}`] = { id: b.id, title: b.title };
  });

  const importKeySet = new Set<string>();
  const importRows: any[] = [];

  for (const row of rows) {
    const key = `${row.date}|${row.slot}|${row.room}`;
    importKeySet.add(key);
    const existing = existingMap[key];

    if (row.title === '予約あり') {
      stats.skip++;
      importRows.push({ batch_id: batch.id, date: row.date, slot: row.slot, room: row.room, title: row.title, org_guess: row.org_guess || null, diff_type: 'skip', existing_booking_id: existing?.id || null, existing_title: existing?.title || null, review_status: 'skipped' });
      continue;
    }

    if (existing) {
      if (existing.title === row.title) {
        stats.skip++;
        importRows.push({ batch_id: batch.id, date: row.date, slot: row.slot, room: row.room, title: row.title, org_guess: row.org_guess || null, diff_type: 'skip', existing_booking_id: existing.id, existing_title: existing.title, review_status: 'skipped' });
      } else {
        stats.update++;
        importRows.push({ batch_id: batch.id, date: row.date, slot: row.slot, room: row.room, title: row.title, org_guess: row.org_guess || null, diff_type: 'update', existing_booking_id: existing.id, existing_title: existing.title, review_status: 'pending' });
      }
    } else {
      stats.add++;
      importRows.push({ batch_id: batch.id, date: row.date, slot: row.slot, room: row.room, title: row.title, org_guess: row.org_guess || null, diff_type: 'add', review_status: 'pending' });
    }
  }

  for (const [key, existing] of Object.entries(existingMap)) {
    if (!importKeySet.has(key) && existing.title !== '予約あり') {
      const [date, slot, room] = key.split('|');
      stats.delete++;
      importRows.push({ batch_id: batch.id, date, slot, room, title: existing.title, diff_type: 'delete', existing_booking_id: existing.id, existing_title: existing.title, review_status: 'pending' });
    }
  }

  if (importRows.length > 0) {
    const { error } = await supabase.from('import_rows').insert(importRows);
    if (error) throw error;
  }

  await supabase.from('import_batches').update({ stats, total_rows: importRows.length }).eq('id', batch.id);

  return stats;
}
