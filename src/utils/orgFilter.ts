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
