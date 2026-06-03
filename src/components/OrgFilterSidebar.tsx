import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Star } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

interface OrgGroup {
  name: string;
  sort_order: number;
}

interface OrgItem {
  name: string;
  group_name: string | null;
  is_active: boolean | null;
}

interface OrgFilterSidebarProps {
  selectedOrgs: Set<string>;
  onToggleOrg: (name: string) => void;
  onToggleGroup: (groupName: string, orgNames: string[]) => void;
  showMajor: boolean;
  onToggleMajor: () => void;
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
  orgs.forEach(o => {
    const g = o.group_name || '未分類';
    if (!orgsByGroup[g]) orgsByGroup[g] = [];
    orgsByGroup[g].push(o);
  });

  const groupColors: Record<string, string> = {
    '自治会': 'text-red-500',
    '委員会': 'text-blue-500',
    '自主活動部': 'text-emerald-500',
    '会員団体': 'text-amber-500',
    '一般': 'text-violet-500',
    'その他/外部': 'text-gray-400',
  };

  const checkboxColors: Record<string, string> = {
    '自治会': 'accent-red-500',
    '委員会': 'accent-blue-500',
    '自主活動部': 'accent-emerald-500',
    '会員団体': 'accent-amber-500',
    '一般': 'accent-violet-500',
    'その他/外部': 'accent-gray-400',
  };

  return (
    <div className="w-52 shrink-0 text-sm select-none">
      {/* 主な予定 */}
      <div className="mb-3">
        <label className="flex items-center gap-2 cursor-pointer px-1 py-1 rounded hover:bg-gray-100">
          <input type="checkbox" checked={showMajor} onChange={onToggleMajor} className="w-3.5 h-3.5 rounded accent-blue-600" />
          <Star size={14} className="text-orange-400" fill="currentColor" />
          <span className="font-bold text-gray-700">主な予定</span>
        </label>
      </div>

      {/* グループ > 団体 */}
      <div className="text-xs font-bold text-gray-400 px-1 mb-1">団体フィルタ</div>
      {groups.map(group => {
        const groupOrgs = orgsByGroup[group.name] || [];
        if (groupOrgs.length === 0) return null;
        const isCollapsed = collapsed[group.name];
        const allChecked = groupOrgs.every(o => selectedOrgs.has(o.name));
        const someChecked = groupOrgs.some(o => selectedOrgs.has(o.name));
        const gc = groupColors[group.name] || 'text-gray-500';
        const cc = checkboxColors[group.name] || 'accent-gray-500';

        return (
          <div key={group.name} className="mb-1">
            {/* グループヘッダー */}
            <div className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-gray-100 cursor-pointer">
              <button onClick={() => setCollapsed(c => ({ ...c, [group.name]: !c[group.name] }))} className="p-0.5">
                {isCollapsed ? <ChevronRight size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
              </button>
              <input
                type="checkbox"
                checked={allChecked}
                ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                onChange={() => onToggleGroup(group.name, groupOrgs.map(o => o.name))}
                className={`w-3.5 h-3.5 rounded ${cc}`}
              />
              <span className={`font-bold text-xs ${gc}`}>{group.name}</span>
              <span className="text-xs text-gray-300 ml-auto">{groupOrgs.filter(o => selectedOrgs.has(o.name)).length}/{groupOrgs.length}</span>
            </div>
            {/* 団体リスト */}
            {!isCollapsed && (
              <div className="ml-7 space-y-px">
                {groupOrgs.map(org => (
                  <label key={org.name} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-gray-100 cursor-pointer">
                    <input type="checkbox" checked={selectedOrgs.has(org.name)} onChange={() => onToggleOrg(org.name)} className={`w-3 h-3 rounded ${cc}`} />
                    <span className="text-xs text-gray-700 truncate">{org.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
