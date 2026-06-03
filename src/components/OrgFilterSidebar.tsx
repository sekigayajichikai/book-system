import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Star } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

interface OrgGroup { name: string; sort_order: number; }
interface OrgItem { name: string; group_name: string | null; is_active: boolean | null; }

interface OrgFilterSidebarProps {
  selectedOrgs: Set<string>;
  onToggleOrg: (name: string) => void;
  onToggleGroup: (groupName: string, orgNames: string[]) => void;
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

export default function OrgFilterSidebar({ selectedOrgs, onToggleOrg, onToggleGroup, showMajor, onToggleMajor }: OrgFilterSidebarProps) {
  const [groups, setGroups] = useState<OrgGroup[]>([]);
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/booking_org_groups?order=sort_order.asc&select=name,sort_order`, { headers }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/booking_organizations?order=name.asc&select=name,group_name,is_active`, { headers }).then(r => r.json()),
    ]).then(([g, o]) => {
      setGroups(g || []);
      setOrgs((o || []).filter((org: OrgItem) => org.is_active !== false));
    }).catch(() => {});
  }, []);

  const orgsByGroup: Record<string, OrgItem[]> = {};
  orgs.forEach(o => { const g = o.group_name || '未分類'; if (!orgsByGroup[g]) orgsByGroup[g] = []; orgsByGroup[g].push(o); });

  return (
    <div className="w-48 shrink-0 select-none">
      {/* 主な予定 */}
      <label className="flex items-center gap-2.5 cursor-pointer py-1.5 px-1 rounded-lg hover:bg-gray-100">
        <ColorCheckbox checked={showMajor} color="#f59e0b" onChange={onToggleMajor} size={18} />
        <span className="text-sm text-gray-700">主な予定</span>
      </label>

      <div className="mt-3">
        {groups.map(group => {
          const groupOrgs = orgsByGroup[group.name] || [];
          if (groupOrgs.length === 0) return null;
          const isCollapsed = collapsed[group.name];
          const allChecked = groupOrgs.every(o => selectedOrgs.has(o.name));
          const color = GROUP_COLORS[group.name] || '#9ca3af';

          return (
            <div key={group.name} className="mb-0.5">
              {/* グループヘッダー */}
              <div className="flex items-center gap-2 py-1 px-1 rounded-lg hover:bg-gray-100 group">
                <ColorCheckbox checked={allChecked} color={color} onChange={() => onToggleGroup(group.name, groupOrgs.map(o => o.name))} size={18} />
                <span className="text-sm font-medium text-gray-700 flex-1 cursor-pointer" onClick={() => setCollapsed(c => ({ ...c, [group.name]: !c[group.name] }))}>{group.name}</span>
                <button onClick={() => setCollapsed(c => ({ ...c, [group.name]: !c[group.name] }))} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5">
                  {isCollapsed ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronUp size={14} className="text-gray-400" />}
                </button>
              </div>
              {/* 団体リスト */}
              {!isCollapsed && (
                <div className="ml-2">
                  {groupOrgs.map(org => (
                    <label key={org.name} className="flex items-center gap-2.5 py-0.5 px-1 ml-4 rounded-lg hover:bg-gray-100 cursor-pointer">
                      <ColorCheckbox checked={selectedOrgs.has(org.name)} color={color} onChange={() => onToggleOrg(org.name)} />
                      <span className="text-[13px] text-gray-600 truncate">{org.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
