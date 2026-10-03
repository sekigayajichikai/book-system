import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseScheduleWorkbook } from '../../api/_scheduleExcel';

/** Excel の日付シリアル値（1900年起算） */
function serial(y: number, m: number, d: number): number {
  return Date.UTC(y, m - 1, d) / 86400000 + 25569;
}

/**
 * 会館日程表のシートを作る。shift=1 で左に列を1本足した形（2026年7・8・10月のシート）になる。
 * plainLastDay=true なら最終日の見出しを日付ではなく数字だけで入れる。
 */
function makeSheet(year: number, month: number, opts: { shift?: number; plainLastDay?: boolean } = {}) {
  const shift = opts.shift ?? 0;
  const days = new Date(year, month, 0).getDate();
  const aoa: (string | number | null)[][] = Array.from({ length: 13 }, () => []);
  aoa[0][0] = '自治会館使用日程表';
  aoa[0][8 + shift] = year;
  aoa[0][10 + shift] = '年';
  aoa[0][11 + shift] = month;
  aoa[0][13 + shift] = '月';
  aoa[1][1 + shift] = '日';
  for (let d = 1; d <= days; d++) {
    // 15日と16日の間に空き列がある（実物の形）
    const col = 2 + shift + d + (d >= 16 ? 1 : 0);
    aoa[1][col] = opts.plainLastDay && d === days ? d : serial(year, month, d);
    aoa[3][col] = d === 1 ? '役員会' : null;
    aoa[11][col] = d === days ? '図書サロン' : null;
  }
  // 翌月1日（前月の残りなどが並ぶ列）
  aoa[1][2 + shift + days + 2] = serial(year, month + 1 > 12 ? 1 : month + 1, 1);
  return XLSX.utils.aoa_to_sheet(aoa);
}

function toBuffer(sheets: Record<string, XLSX.WorkSheet>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, ws] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, ws, name);
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return out;
}

const NOW = new Date(2026, 9, 3); // 2026-10-03

describe('parseScheduleWorkbook', () => {
  it('いつもの形のシートを読む', () => {
    const { months, warnings } = parseScheduleWorkbook(toBuffer({ '9月': makeSheet(2026, 11) }), NOW);
    expect(warnings).toEqual([]);
    expect(months).toHaveLength(1);
    expect(months[0]).toMatchObject({ year: 2026, month: 11 });
    expect(months[0].rows).toEqual([
      expect.objectContaining({ date: '2026-11-01', slot: '午前', room: '会議室', title: '役員会' }),
      expect.objectContaining({ date: '2026-11-30', slot: '午後', room: '図書室', title: '図書サロン' }),
    ]);
  });

  it('左に列が1本増えたシートも読む（2026年10月分で起きた形）', () => {
    const { months, warnings } = parseScheduleWorkbook(toBuffer({ '10月': makeSheet(2026, 10, { shift: 1 }) }), NOW);
    expect(warnings).toEqual([]);
    expect(months[0]).toMatchObject({ year: 2026, month: 10 });
    expect(months[0].rows.map(r => r.date)).toEqual(['2026-10-01', '2026-10-31']);
  });

  it('最終日の見出しが数字だけでも、その日を読む', () => {
    const { months, warnings } = parseScheduleWorkbook(
      toBuffer({ '10月': makeSheet(2026, 10, { shift: 1, plainLastDay: true }) }), NOW);
    expect(warnings).toEqual([]);
    expect(months[0].rows.map(r => r.date)).toContain('2026-10-31');
  });

  it('年・月が読めない日程表シートは、黙って飛ばさず知らせる', () => {
    const ws = makeSheet(2026, 10);
    delete ws['L1'];
    const { months, warnings } = parseScheduleWorkbook(toBuffer({ '10月分': ws, Sheet1: XLSX.utils.aoa_to_sheet([[]]) }), NOW);
    expect(months).toEqual([]);
    expect(warnings).toEqual(['「10月分」は年・月が読めないため取り込みませんでした']);
  });

  it('読めない日があれば知らせる', () => {
    const ws = makeSheet(2026, 10);
    delete ws[XLSX.utils.encode_cell({ r: 1, c: 2 + 5 })]; // 5日の見出しを消す
    const { warnings } = parseScheduleWorkbook(toBuffer({ '10月分': ws }), NOW);
    expect(warnings).toEqual(['「10月分」の 5日 は日付が読めないため取り込みませんでした']);
  });

  it('当月より前のシートは取り込まない（知らせもしない）', () => {
    const { months, warnings } = parseScheduleWorkbook(toBuffer({ '9月': makeSheet(2026, 9) }), NOW);
    expect(months).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
