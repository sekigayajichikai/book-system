import { useEffect, useState } from 'react';

/**
 * 団体マスタ（booking_organizations）の引き当て表。
 * - nameById: 団体の番号 → 今の正式名
 * - nameByKey: 正式名・別名（表記ゆれを吸収した形）→ 今の正式名
 */
export interface OrgDirectory {
  nameById: Map<string, string>;
  nameByKey: Map<string, string>;
}

/** 表記ゆれの吸収（空白を消し（JS の \s は全角スペースも含む）、ケ/ｹ をヶに寄せる。portal の resolveOrganizerName と同じ考え方） */
export function normalizeOrgName(s: string): string {
  return s.replace(/\s/g, '').replace(/[ケｹ]/g, 'ヶ');
}

export function buildOrgDirectory(orgs: { id: string; name: string; aliases?: string[] | null }[]): OrgDirectory {
  const nameById = new Map<string, string>();
  const nameByKey = new Map<string, string>();
  for (const o of orgs) {
    if (!o?.name) continue;
    nameById.set(o.id, o.name);
    // 正式名を別名より優先する（別名が他の団体の正式名と同じでも取り違えない）
    nameByKey.set(normalizeOrgName(o.name), o.name);
  }
  for (const o of orgs) {
    for (const a of o?.aliases || []) {
      const k = normalizeOrgName(a);
      if (k && !nameByKey.has(k)) nameByKey.set(k, o.name);
    }
  }
  return { nameById, nameByKey };
}

/**
 * 団体マスタの引き当て表を取得する。
 *
 * 「表示する団体」フィルタのチェックボックスは団体マスタから作られるので、
 * マスタに無い団体名（表記が違う団体など）はどのチェックにも現れず、
 * そのままだと絞り込みで必ず落ちて画面に出てこない。それを「未分類」として扱えるようにする。
 */
export function useOrgDirectory(): OrgDirectory | null {
  const sbUrl = import.meta.env.VITE_SUPABASE_URL;
  const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  // 接続先が無いときは最初から空の表（読み込み中のままにしない）
  const [dir, setDir] = useState<OrgDirectory | null>(() => (sbUrl && sbKey ? null : buildOrgDirectory([])));
  useEffect(() => {
    if (!sbUrl || !sbKey) return;
    // aliases 列が無い古いDBでも動くよう * で取る
    fetch(`${sbUrl}/rest/v1/booking_organizations?select=*`, {
      headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
    })
      .then(r => (r.ok ? r.json() : []))
      .then(d => setDir(buildOrgDirectory(Array.isArray(d) ? d : [])))
      .catch(() => setDir(buildOrgDirectory([])));
  }, [sbUrl, sbKey]);
  return dir;
}

/**
 * 予定の主催団体の、今の正式名を返す。団体マスタに無ければ null（「未分類」の扱い）。
 * 団体の番号（org_id）があればそれで引く。名前の書き方や改名に左右されない。
 * 番号が無ければ主催者名を正式名・別名と照らし合わせる。
 * 引き当て表の読み込み中（dir が null）は、主催者名をそのまま使う。
 */
export function resolveEventOrgName(
  e: { orgId?: string | null; orgName?: string | null },
  dir: OrgDirectory | null,
): string | null {
  if (!dir) return e.orgName || null;
  if (e.orgId) {
    const byId = dir.nameById.get(e.orgId);
    if (byId) return byId;
  }
  if (!e.orgName) return null;
  return dir.nameByKey.get(normalizeOrgName(e.orgName)) ?? null;
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
 * 「表示する団体」の絞り込みで、主催団体だけで表示・非表示が決まるか。
 * - true: 主催団体にチェックが入っている → 表示
 * - false: 団体マスタにある団体で、チェックが外れている → 非表示
 * - null: 団体マスタに無い（または主催が空）→ 呼び出し側で「未分類」などの扱いに回す
 * 引き当て表の読み込み中は false を返さないので、読み込み中に予定が消えることはない。
 */
export function orgFilterDecision(
  e: { orgId?: string | null; orgName?: string | null },
  filterOrgs: Set<string>,
  dir: OrgDirectory | null,
): boolean | null {
  const org = resolveEventOrgName(e, dir);
  if (org && filterOrgs.has(org)) return true;
  if (org && dir) return false;
  return null;
}
