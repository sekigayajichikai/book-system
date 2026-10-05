import { describe, it, expect } from 'vitest';
import { reconcileOrgFilter, orgNamesForSeen, buildOrgDirectory, resolveEventOrgName, orgFilterDecision } from './orgFilter';

// 保存済みの「表示する団体」を今の団体マスタに合わせて直すテスト。
// 改名・新しい団体で住民の画面から予定が黙って消えないことを確かめる。
describe('reconcileOrgFilter', () => {
  const old = '2026-05-16T00:00:00Z';
  const added = '2026-10-05T03:00:00Z';

  it('旧名にチェックが入っていた団体は、改名後もチェックが入る', () => {
    const saved = new Set(['自治会', '__未分類__']);
    const orgs = [{ name: '関ヶ谷自治会', aliases: ['自治会'], created_at: old }];
    expect(reconcileOrgFilter(saved, orgs, null).has('関ヶ谷自治会')).toBe(true);
  });

  it('旧名を自分で外していた団体は、改名後も外れたまま', () => {
    const saved = new Set(['図書部']);
    const orgs = [{ name: '関ヶ谷自治会', aliases: ['自治会'], created_at: old }];
    expect(reconcileOrgFilter(saved, orgs, new Set(['自治会', '図書部'])).has('関ヶ谷自治会')).toBe(false);
    expect(reconcileOrgFilter(saved, orgs, null).has('関ヶ谷自治会')).toBe(false);
  });

  it('前回の一覧に無い団体は、新しい団体としてチェックが入る', () => {
    const saved = new Set(['図書部']);
    const orgs = [
      { name: '図書部', created_at: old },
      { name: '西金沢地域ケアプラザ', aliases: ['ケアプラザ'], created_at: added },
    ];
    expect(reconcileOrgFilter(saved, orgs, new Set(['図書部'])).has('西金沢地域ケアプラザ')).toBe(true);
  });

  it('前回の一覧に載っていて外した団体は、外れたまま', () => {
    const saved = new Set(['図書部']);
    const orgs = [{ name: '防災部', created_at: old }];
    expect(reconcileOrgFilter(saved, orgs, new Set(['図書部', '防災部'])).has('防災部')).toBe(false);
  });

  it('一覧を持たない古い保存形式では、一本化の日以降に登録された団体だけチェックが入る', () => {
    const saved = new Set(['図書部']);
    const orgs = [
      { name: '防災部', created_at: old },
      { name: '横浜南共済病院', created_at: added },
    ];
    const next = reconcileOrgFilter(saved, orgs, null);
    expect(next.has('防災部')).toBe(false);
    expect(next.has('横浜南共済病院')).toBe(true);
  });

  it('別名の列がまだ無い（DB変更前）でも動く', () => {
    const saved = new Set(['図書部']);
    const orgs = [{ name: '図書部', created_at: old }, { name: '防災部', created_at: old }];
    expect([...reconcileOrgFilter(saved, orgs, null)]).toEqual(['図書部']);
  });
});

describe('orgNamesForSeen', () => {
  it('正式名と別名をまとめて重複なく返す', () => {
    expect(orgNamesForSeen([
      { name: '関ヶ谷クラブ', aliases: ['関ケ谷クラブ'] },
      { name: '図書部' },
    ])).toEqual(['関ヶ谷クラブ', '関ケ谷クラブ', '図書部']);
  });
});

// 予定の主催団体で絞り込むテスト。団体の番号を優先し、改名や表記ゆれに左右されないことを確かめる。
describe('orgFilterDecision', () => {
  const dir = buildOrgDirectory([
    { id: 'jichikai', name: '関ヶ谷自治会', aliases: ['自治会'] },
    { id: 'club', name: '関ヶ谷クラブ', aliases: ['関ケ谷クラブ'] },
    { id: 'tosho', name: '図書部', aliases: [] },
  ]);

  it('団体の番号があれば、主催者名が古くても今の正式名で判定する', () => {
    expect(resolveEventOrgName({ orgId: 'jichikai', orgName: '自治会' }, dir)).toBe('関ヶ谷自治会');
    expect(orgFilterDecision({ orgId: 'jichikai', orgName: '自治会' }, new Set(['関ヶ谷自治会']), dir)).toBe(true);
  });

  it('番号が無くても、別名や ケ/ヶ の違いは正式名に寄せる', () => {
    expect(resolveEventOrgName({ orgName: '関ケ谷クラブ' }, dir)).toBe('関ヶ谷クラブ');
    expect(resolveEventOrgName({ orgName: '関 ケ谷クラブ' }, dir)).toBe('関ヶ谷クラブ');
    expect(resolveEventOrgName({ orgName: '関ヶ谷　クラブ' }, dir)).toBe('関ヶ谷クラブ'); // 全角スペース
    expect(resolveEventOrgName({ orgName: 'u30図書部' }, dir)).toBeNull(); // 英数字は消さない
  });

  it('マスタにある団体でチェックが外れていれば非表示', () => {
    expect(orgFilterDecision({ orgId: 'tosho', orgName: '図書部' }, new Set(['関ヶ谷自治会']), dir)).toBe(false);
  });

  it('マスタに無い主催・空の主催は呼び出し側（未分類）に任せる', () => {
    expect(orgFilterDecision({ orgName: '知らない団体' }, new Set(['図書部']), dir)).toBeNull();
    expect(orgFilterDecision({ orgName: null }, new Set(['図書部']), dir)).toBeNull();
  });

  it('引き当て表の読み込み中は非表示にしない', () => {
    expect(orgFilterDecision({ orgName: '図書部' }, new Set(['関ヶ谷自治会']), null)).toBeNull();
    expect(orgFilterDecision({ orgName: '図書部' }, new Set(['図書部']), null)).toBe(true);
  });

  it('別名が他の団体の正式名と同じでも、正式名のほうを優先する', () => {
    const d = buildOrgDirectory([
      { id: 'a', name: '自治会', aliases: [] },
      { id: 'b', name: '関ヶ谷自治会', aliases: ['自治会'] },
    ]);
    expect(resolveEventOrgName({ orgName: '自治会' }, d)).toBe('自治会');
  });
});