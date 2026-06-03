import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

interface OrgGroup { name: string; sort_order: number; }
interface OrgItem { name: string; group_name: string | null; is_active: boolean | null; id?: string; created_at?: string; registration_date?: string; }

interface OrgFilterSidebarProps {
  selectedOrgs: Set<string>;
  onToggleOrg: (name: string) => void;
  onToggleGroup: (groupName: string, orgNames: string[]) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSelectOnly: (name: string) => void;
  showMajor: boolean;
  onToggleMajor: () => void;
}

const GROUP_COLORS: Record<string, string> = {
  '自治会': '#ef4444', '委員会': '#3b82f6', '自主活動部': '#10b981',
  '会員団体': '#f59e0b', '一般': '#8b5cf6', 'その他/外部': '#9ca3af',
};

function ColorCheckbox({ checked, color, onChange, size = 16 }: { checked: boolean; color: string; onChange: () => void; size?: number }) {
  return (
    <button onClick={onChange} className="shrink-0 flex items-center justify-center rounded-sm border transition-colors"
      style={{ width: size, height: size, backgroundColor: checked ? color : 'transparent', borderColor: checked ? color : '#d1d5db' }}>
      {checked && <svg width={size - 4} height={size - 4} viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </button>
  );
}

export default function OrgFilterSidebar({ selectedOrgs, onToggleOrg, onToggleGroup, onSelectAll, onDeselectAll, onSelectOnly, showMajor, onToggleMajor }: OrgFilterSidebarProps) {
  const [groups, setGroups] = useState<OrgGroup[]>([]);
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean> | null>(null);
  const [orgSectionOpen, setOrgSectionOpen] = useState(true);
  const [orgLastUsed, setOrgLastUsed] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/booking_org_groups?order=sort_order.asc&select=name,sort_order`, { headers }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/booking_organizations?order=name.asc&select=id,name,group_name,is_active,created_at,registration_date`, { headers }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/bookings?select=org_id,title,date&order=date.desc`, { headers }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/booking_organizations?select=id,name`, { headers }).then(r => r.json()),
    ]).then(([g, o, bookingData, orgIdMap]) => {
      setGroups(g || []);

      // 各団体の最終利用日を算出
      const lastUsed: Record<string, string> = {};
      (bookingData || []).forEach((b: any) => {
        if (b.org_id && !lastUsed[b.org_id]) lastUsed[b.org_id] = b.date;
      });
      (orgIdMap || []).forEach((org: any) => {
        if (lastUsed[org.id]) return;
        const match = (bookingData || []).find((b: any) =>
          b.title && org.name && (b.title.includes(org.name) || org.name.includes(b.title))
        );
        if (match) lastUsed[org.id] = match.date;
      });
      setOrgLastUsed(lastUsed);

      // 6ヶ月判定でアクティブ団体のみ残す
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const cutoff = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-${String(sixMonthsAgo.getDate()).padStart(2, '0')}`;

      const activeOrgs = (o || []).filter((org: OrgItem) => {
        if (org.is_active === true) return true;
        if (org.is_active === false) return false;
        // 自動判定 (null)
        const last = lastUsed[org.id || ''];
        if (last && last >= cutoff) return true;
        if (org.registration_date && org.registration_date >= cutoff) return true;
        if (org.created_at && org.created_at >= cutoff) return true;
        return false;
      });
      setOrgs(activeOrgs);

      // デフォルト全折りたたみ
      const c: Record<string, boolean> = {};
      (g || []).forEach((gr: OrgGroup) => { c[gr.name] = true; });
      setCollapsed(c);
    }).catch(() => {});
  }, []);

  const orgsByGroup: Record<string, OrgItem[]> = {};
  orgs.forEach(o => { const g = o.group_name || '未分類'; if (!orgsByGroup[g]) orgsByGroup[g] = []; orgsByGroup[g].push(o); });

  if (!collapsed) return null;

  return (
    <div className="w-48 shrink-0 select-none">
      <div className="text-lg font-bold text-gray-800 px-1 pt-3 pb-2 mb-2">関ヶ谷自治会</div>

      {/* 主な予定（カレンダーのイベントラベル風） */}
      <button onClick={onToggleMajor}
        className={`flex items-center gap-1.5 w-full text-left text-sm font-bold rounded px-2 py-1 mb-2 transition-colors ${
          showMajor ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200 line-through'
        }`}>
        <span className={`w-2 h-2 rounded-full shrink-0 ${showMajor ? 'bg-blue-500' : 'bg-gray-300'}`} />
        主な予定
      </button>

      {/* 表示する団体 */}
      <button onClick={() => setOrgSectionOpen(v => !v)}
        className="flex items-center justify-between w-full text-sm text-gray-500 font-bold px-1 mt-4 mb-1.5 pt-3 border-t border-gray-200 hover:text-gray-700 transition-colors">
        <span>表示する団体</span>
        {orgSectionOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {orgSectionOpen && <>
      <div className="flex gap-2 px-1 mb-1 text-xs">
        <button onClick={onSelectAll} className="text-blue-500 hover:underline">全選択</button>
        <button onClick={onDeselectAll} className="text-blue-500 hover:underline">全解除</button>
      </div>

      {/* グループ > 団体 */}
      <div className="space-y-0.5">
        {groups.map(group => {
          const groupOrgs = orgsByGroup[group.name] || [];
          if (groupOrgs.length === 0) return null;
          const isCollapsed = collapsed[group.name];
          const allChecked = groupOrgs.every(o => selectedOrgs.has(o.name));
          const color = GROUP_COLORS[group.name] || '#9ca3af';

          return (
            <div key={group.name}>
              {/* グループヘッダー */}
              <div className="flex items-center gap-2 py-1 px-1 rounded-lg hover:bg-gray-100 group">
                <ColorCheckbox checked={allChecked} color={color} onChange={() => onToggleGroup(group.name, groupOrgs.map(o => o.name))} size={18} />
                <span className="text-sm font-medium text-gray-700 flex-1 cursor-pointer" onClick={() => setCollapsed(c => ({ ...c!, [group.name]: !c![group.name] }))}>{group.name}</span>
                <button onClick={() => setCollapsed(c => ({ ...c!, [group.name]: !c![group.name] }))} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5">
                  {isCollapsed ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronUp size={14} className="text-gray-400" />}
                </button>
              </div>
              {/* 団体リスト */}
              {!isCollapsed && (
                <div className="ml-2">
                  {groupOrgs.map(org => (
                    <div key={org.name} className="flex items-center gap-2.5 py-0.5 px-1 ml-4 rounded-lg hover:bg-gray-100 cursor-pointer"
                      onClick={e => { e.shiftKey ? onSelectOnly(org.name) : onToggleOrg(org.name); }}>
                      <ColorCheckbox checked={selectedOrgs.has(org.name)} color={color} onChange={() => {}} />
                      <span className="text-[13px] text-gray-600 truncate">{org.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </>}
    </div>
  );
}
