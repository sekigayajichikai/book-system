import { useEffect, useState } from 'react';

/**
 * 団体マスタ（booking_organizations）に登録されている団体名の一覧を取得する。
 *
 * 「表示する団体」フィルタのチェックボックスは団体マスタから作られるので、
 * マスタに無い団体名（回覧板から取り込んだ外部団体や、表記が違う団体など）は
 * どのチェックにも現れず、そのままだと絞り込みで必ず落ちて画面に出てこない。
 * それを「未分類」として扱えるように、既知の団体名を覚えておく。
 */
export function useKnownOrgNames(): Set<string> | null {
  const [known, setKnown] = useState<Set<string> | null>(null);
  useEffect(() => {
    const sbUrl = import.meta.env.VITE_SUPABASE_URL;
    const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!sbUrl || !sbKey) { setKnown(new Set()); return; }
    fetch(`${sbUrl}/rest/v1/booking_organizations?select=name`, {
      headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
    })
      .then(r => (r.ok ? r.json() : []))
      .then(d => setKnown(new Set<string>((d || []).map((o: any) => o.name).filter(Boolean))))
      .catch(() => setKnown(new Set()));
  }, []);
  return known;
}

/** 保存済みの絞り込みを読み直すときに使う団体の情報 */
export interface OrgForFilter {
  name: string;
  aliases?: string[] | null;
  created_at?: string | null;
}

/**
 * 団体の名簿を一本化した日（2026-10-05）。これ以降に登録された団体は、
 * 「前回見た団体の一覧」を持たない古い保存形式でも新しい団体として扱う。
 * （それまで外部団体は団体マスタに無く「未分類」として見えていたので、急に消えないようにする）
 */
const ORG_UNIFY_DATE = '2026-10-05T00:00:00+09:00';

/**
 * 保存済みの「表示する団体」を、今の団体マスタに合わせて直す。
 *
 * 絞り込みは団体の名前でブラウザに保存しているので、そのままだと
 * - 改名した団体（自治会 → 関ヶ谷自治会 など）がチェックなしになる
 * - あとから登録した団体がチェックなしになる
 * のどちらも、住民の画面で予定が黙って消える原因になる。
 *
 * - 旧名（別名 aliases に残っている）にチェックが入っていた団体 → 新しい名前でもチェックを入れる
 * - 前回見た一覧（seen）に無い団体 → 新しく出てきた団体なのでチェックを入れる
 * - seen が無い古い保存形式 → 一本化の日以降に登録された団体だけチェックを入れる
 * 自分で外した団体はそのまま外れている（旧名でも前回の一覧に載っているため）。
 */
export function reconcileOrgFilter(
  saved: Set<string>,
  orgs: OrgForFilter[],
  seen: Set<string> | null,
): Set<string> {
  const next = new Set(saved);
  for (const org of orgs) {
    if (next.has(org.name)) continue;
    const aliases = org.aliases || [];
    if (aliases.some(a => saved.has(a))) { next.add(org.name); continue; }
    const isNew = seen
      ? !seen.has(org.name) && !aliases.some(a => seen.has(a))
      : !!org.created_at && new Date(org.created_at) >= new Date(ORG_UNIFY_DATE);
    if (isNew) next.add(org.name);
  }
  return next;
}

/** 前回見た団体の一覧として保存する名前（正式名と別名） */
export function orgNamesForSeen(orgs: OrgForFilter[]): string[] {
  return [...new Set(orgs.flatMap(o => [o.name, ...(o.aliases || [])]))];
}

/**
 * その団体名が「表示する団体」フィルタで切り替えられる団体かどうか。
 * マスタに登録がある団体名だけが対象。取得が済むまでは false を返すので、
 * 読み込み中に予定が消えることはない。
 */
export function isFilterableOrg(
  orgName: string | null | undefined,
  knownOrgs: Set<string> | null,
): boolean {
  return !!orgName && !!knownOrgs && knownOrgs.has(orgName);
}
