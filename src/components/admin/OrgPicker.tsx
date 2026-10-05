import { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

interface OrgGroup {
  id: string;
  name: string;
  sort_order: number;
}

interface OrgItem {
  id: string;
  name: string;
  group_name: string | null;
  is_active: boolean | null;
  /** 会館を予約する団体か（外部団体は false。DB変更前は列が無いので undefined） */
  can_book?: boolean;
}

// キャッシュ（同一セッション内で再fetchしない）
let cachedGroups: OrgGroup[] | null = null;
let cachedOrgs: OrgItem[] | null = null;

async function fetchMasters() {
  if (cachedGroups && cachedOrgs) return { groups: cachedGroups, orgs: cachedOrgs };
  const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };
  const [gRes, oRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/booking_org_groups?order=sort_order.asc&select=id,name,sort_order`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/booking_organizations?order=name.asc&select=*`, { headers }),
  ]);
  cachedGroups = gRes.ok ? await gRes.json() : [];
  cachedOrgs = oRes.ok ? await oRes.json() : [];
  return { groups: cachedGroups!, orgs: cachedOrgs! };
}

interface OrgPickerProps {
  value: string;
  onChange: (name: string) => void;
  placeholder?: string;
  className?: string;
  /** 会館の予約用。会館を予約しない外部団体（can_book = false）を出さない */
  bookingOnly?: boolean;
}

export default function OrgPicker({ value, onChange, placeholder = '団体名', className = '', bookingOnly = false }: OrgPickerProps) {
  const [groups, setGroups] = useState<OrgGroup[]>([]);
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [freeInput, setFreeInput] = useState(false);

  useEffect(() => {
    fetchMasters().then(({ groups: g, orgs: o }) => {
      setGroups(g);
      setOrgs(o);
      // 初期値がある場合、そのグループを自動選択
      if (value) {
        const match = o.find(org => org.name === value);
        if (match?.group_name) setSelectedGroup(match.group_name);
      }
    });
  }, []);

  const pickableOrgs = bookingOnly ? orgs.filter(o => o.can_book !== false) : orgs;
  const filteredOrgs = selectedGroup
    ? pickableOrgs.filter(o => o.group_name === selectedGroup && o.is_active !== false)
    : [];
  // 予約用では、選べる団体が1つも無いグループ（地域の団体・施設 など）は出さない
  const pickableGroups = bookingOnly ? groups.filter(g => pickableOrgs.some(o => o.group_name === g.name)) : groups;

  if (freeInput) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <input value={value} onChange={e => onChange(e.target.value)}
          className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400"
          placeholder={placeholder} />
        <button type="button" onClick={() => setFreeInput(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title="選択に戻す">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M11 4h4"/><path d="M11 8h7"/><path d="M11 12h10"/></svg>
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center gap-1">
        <select value={selectedGroup} onChange={e => { setSelectedGroup(e.target.value); if (!e.target.value) onChange(''); }}
          className="flex-1 min-w-0 px-1.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400 bg-white">
          <option value="">-- グループ --</option>
          {pickableGroups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
        </select>
        <select value={value} onChange={e => onChange(e.target.value)} disabled={!selectedGroup}
          className="flex-1 min-w-0 px-1.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400 bg-white disabled:bg-gray-100 disabled:text-gray-400">
          <option value="">-- 団体 --</option>
          {filteredOrgs.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
        </select>
        <button type="button" onClick={() => setFreeInput(true)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title="手入力">
          <Pencil size={14} />
        </button>
      </div>
    </div>
  );
}
