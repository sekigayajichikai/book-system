import * as XLSX from 'xlsx';

/**
 * 会館日程表（Excel）の読み取り
 *
 * 管理画面のExcel取込（src/components/admin/ImportTab.tsx）と
 * Googleドライブ同期（api/sync-drive.ts）の両方がこれを使う。
 * 以前は同じ処理が2か所にコピーされていた。
 *
 * 2026-10-03: 7月・8月・10月のシートは左に列が1本増えていて、
 * 「年」「月」が I1 / L1 から J1 / M1 にずれていた。決め打ちの番地を読んでいたため、
 * そのシートは何も言わずに飛ばされ、10月の予定が丸ごと入らなかった。
 * いまは見出し行の「年」「月」の文字を探し、その左の数字を読む。
 * 読めなかったシートや日は warnings に入れて、画面に出す。
 */

// 団体推測用
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

export function guessOrg(title: string): string {
  for (const [kw, org] of Object.entries(ORG_MAP)) {
    if (title.includes(kw)) return org;
  }
  return '';
}

// 行定義（0-indexed row）。列が増えても行は変わっていないので行番号で持つ
const ROWS_DEF: [number, string, string][] = [
  [3, '午前', '会議室'], [4, '午前', '和室（畳側）'],
  [5, '午前', '和室（椅子側）'], [6, '午前', '図書室'],
  [8, '午後', '会議室'], [9, '午後', '和室（畳側）'],
  [10, '午後', '和室（椅子側）'], [11, '午後', '図書室'],
  [12, '夜間', '会議室'],
];

export interface ParsedRow {
  date: string;
  slot: string;
  room: string;
  title: string;
  org_guess: string;
}

export interface ParsedMonth {
  year: number;
  month: number;
  rows: ParsedRow[];
}

export interface ParseResult {
  months: ParsedMonth[];
  /** 読めなかったシートや日。画面にそのまま出す文 */
  warnings: string[];
}

/** セルの値を数値にする（全角数字の文字列も受ける）。数値でなければ null */
function cellNumber(cell: XLSX.CellObject | undefined): number | null {
  if (!cell) return null;
  if (cell.t === 'n' && typeof cell.v === 'number') return cell.v;
  if (cell.t === 's' && typeof cell.v === 'string') {
    const s = cell.v.trim().replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
    if (/^\d+$/.test(s)) return Number(s);
  }
  return null;
}

/** 見出し行（1行目）から「年」「月」の文字を探し、その左にある数字を読む */
function findYearMonth(ws: XLSX.WorkSheet, lastCol: number): { year: number; month: number } | null {
  const numberLeftOf = (label: string): number | null => {
    for (let c = 0; c <= lastCol; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
      if (!cell || typeof cell.v !== 'string' || cell.v.trim() !== label) continue;
      // 結合セルの都合で数字が2〜3列左にあることがある
      for (let k = c - 1; k >= Math.max(0, c - 3); k--) {
        const n = cellNumber(ws[XLSX.utils.encode_cell({ r: 0, c: k })]);
        if (n !== null) return n;
      }
    }
    return null;
  };
  const year = numberLeftOf('年');
  const month = numberLeftOf('月');
  if (year === null || month === null) return null;
  if (!(year >= 2020 && year <= 2099 && month >= 1 && month <= 12)) return null;
  return { year, month };
}

export function parseScheduleWorkbook(buffer: ArrayBuffer, now: Date = new Date()): ParseResult {
  const wb = XLSX.read(buffer, { type: 'array' });
  const months: ParsedMonth[] = [];
  const warnings: string[] = [];

  // 当月〜12ヶ月先のみ対象
  const minYM = now.getFullYear() * 12 + now.getMonth();
  const maxYM = minYM + 12;

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const sheetLabel = `「${name.trim()}」`;
    if (!ws['!ref']) continue; // 空のシート
    const range = XLSX.utils.decode_range(ws['!ref']);

    const ym = findYearMonth(ws, range.e.c);
    if (!ym) {
      // 日程表らしいシートなら知らせる（空の Sheet1 などは黙って飛ばす）
      const a1 = ws['A1'];
      if (a1 && typeof a1.v === 'string' && a1.v.includes('日程表')) {
        warnings.push(`${sheetLabel}は年・月が読めないため取り込みませんでした`);
      }
      continue;
    }
    const { year, month } = ym;

    const ymIndex = year * 12 + (month - 1);
    if (ymIndex < minYM || ymIndex > maxYM) continue; // 範囲外はスキップ

    // 日付列を検出（2行目）。日付の値のほか、「31」のように数字だけの見出しも受ける
    const daysInMonth = new Date(year, month, 0).getDate();
    const dateCols: { col: number; day: number }[] = [];
    const seenDays = new Set<number>();
    let lastDay = 0;
    for (let c = 0; c <= range.e.c; c++) {
      const n = cellNumber(ws[XLSX.utils.encode_cell({ r: 1, c })]);
      if (n === null) continue;
      let day: number | null = null;
      if (n > 40000) {
        const d = XLSX.SSF.parse_date_code(n);
        if (d.m === month) day = d.d;
      } else if (Number.isInteger(n) && n > lastDay && n <= daysInMonth) {
        // 数字だけの見出しは、前の日より後のときだけ日として扱う（翌月の「1」などを拾わない）
        day = n;
      }
      if (day === null || seenDays.has(day)) continue;
      seenDays.add(day);
      lastDay = Math.max(lastDay, day);
      dateCols.push({ col: c, day });
    }

    if (dateCols.length === 0) {
      warnings.push(`${sheetLabel}は日付の列が読めないため取り込みませんでした`);
      continue;
    }
    const missing: number[] = [];
    for (let d = 1; d <= daysInMonth; d++) if (!seenDays.has(d)) missing.push(d);
    if (missing.length > 0) {
      warnings.push(`${sheetLabel}の ${missing.join('・')}日 は日付が読めないため取り込みませんでした`);
    }

    const rows: ParsedRow[] = [];
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

    if (rows.length > 0) months.push({ year, month, rows });
  }

  return { months, warnings };
}
