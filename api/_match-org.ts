/**
 * タイトルから団体を自動マッチする共通ロジック
 * import.ts / sync-drive.ts から共用
 */

interface OrgEntry {
  id: string;
  name: string;
  keywords: string[];
}

/** Supabaseから団体一覧を取得してマッチャーを返す */
export async function createOrgMatcher(supabase: any): Promise<(title: string) => string | null> {
  const { data: orgs } = await supabase
    .from('booking_organizations')
    .select('id, name, keywords');

  const orgList: OrgEntry[] = (orgs || []).map((o: any) => ({
    id: o.id, name: o.name, keywords: o.keywords || [],
  }));

  const sorted = [...orgList].sort((a, b) => b.name.length - a.name.length);

  return function matchOrgId(title: string): string | null {
    // 1. 団体名がタイトルに含まれるか
    for (const org of sorted) {
      if (title.includes(org.name)) return org.id;
    }
    // 2. キーワードがタイトルに含まれるか
    for (const org of sorted) {
      for (const kw of org.keywords) {
        if (kw && title.includes(kw)) return org.id;
      }
    }
    // 3. タイトル先頭部分が団体名に含まれるか
    const cleaned = title.replace(/[（()）\s].*/g, '').trim();
    if (cleaned.length >= 2) {
      for (const org of sorted) {
        if (org.name.includes(cleaned)) return org.id;
      }
    }
    return null;
  };
}
