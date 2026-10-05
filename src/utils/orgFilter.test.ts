import { describe, it, expect } from 'vitest';
import { reconcileOrgFilter, orgNamesForSeen } from './orgFilter';

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
