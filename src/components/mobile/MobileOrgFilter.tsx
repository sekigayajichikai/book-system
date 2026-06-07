import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

interface OrgGroup { name: string; sort_order: number; }

const GROUP_COLORS: Record<string, string> = {
  '自治会': '#ef4444', '委員会': '#3b82f6', '自主活動部': '#10b981',
  '会員団体': '#f59e0b', '一般団体': '#8b5cf6', 'その他/外部': '#9ca3af',
};

interface Props {
  filterOrgs: Set<string>;
  onToggleGroup: (groupName: string, orgNames: string[]) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onToggleOrg: (name: string) => void;
  onClose: () => void;
}

export default function MobileOrgFilter({ filterOrgs, onToggleGroup, onSelectAll, onDeselectAll, onToggleOrg, onClose }: Props) {
  const [groups, setGroups] = useState<OrgGroup[]>([]);
  const [orgsByGroup, setOrgsByGroup] = useState<Record<string, string[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` };
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/booking_org_groups?order=sort_order.asc&select=name,sort_order`, { headers }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/booking_organizations?select=name,group_name&is_active=not.is.false&order=name`, { headers }).then(r => r.json()),
    ]).then(([g, orgs]) => {
      setGroups(g || []);
      const map: Record<string, string[]> = {};
      (orgs || []).forEach((o: any) => {
        const gn = o.group_name || '未分類';
        if (!map[gn]) map[gn] = [];
        map[gn].push(o.name);
      });
      setOrgsByGroup(map);
    }).catch(() => {});
  }, []);

  const isGroupChecked = (groupName: string) => {
    const names = orgsByGroup[groupName] || [];
    return names.length > 0 && names.every(n => filterOrgs.has(n));
  };

  const isGroupPartial = (groupName: string) => {
    const names = orgsByGroup[groupName] || [];
    const checked = names.filter(n => filterOrgs.has(n)).length;
    return checked > 0 && checked < names.length;
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* 背景オーバーレイ */}
      <div className="absolute inset-0 bg-black/40" />

      {/* ボトムシート */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl animate-slide-up max-h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ハンドル */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-700">表示する団体</span>
          <div className="flex items-center gap-3">
            <button onClick={onSelectAll} className="text-xs text-blue-500 font-bold">全選択</button>
            <button onClick={onDeselectAll} className="text-xs text-blue-500 font-bold">全解除</button>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* グループ一覧 */}
        <div className="overflow-y-auto px-4 py-3 space-y-1">
          {groups.map(group => {
            const names = orgsByGroup[group.name] || [];
            if (names.length === 0) return null;
            const checked = isGroupChecked(group.name);
            const partial = isGroupPartial(group.name);
            const color = GROUP_COLORS[group.name] || '#9ca3af';

            const isExpanded = expanded[group.name];

            return (
              <div key={group.name}>
                <div className="flex items-center gap-1 py-2 px-2 rounded-lg active:bg-gray-100">
                  <button className="shrink-0 p-0.5" onClick={() => onToggleGroup(group.name, names)}>
                    <span
                      className="w-5 h-5 rounded flex items-center justify-center border-2"
                      style={{
                        backgroundColor: checked || partial ? color : 'transparent',
                        borderColor: checked || partial ? color : '#d1d5db',
                      }}
                    >
                      {checked && (
                        <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {partial && (
                        <div className="w-2.5 h-0.5 bg-white rounded" />
                      )}
                    </span>
                  </button>
                  <button className="flex-1 flex items-center gap-2 text-left" onClick={() => setExpanded(e => ({ ...e, [group.name]: !e[group.name] }))}>
                    <span className="text-sm text-gray-700">{group.name}</span>
                    <span className="text-xs text-gray-400">{names.filter(n => filterOrgs.has(n)).length}/{names.length}</span>
                    {isExpanded ? <ChevronUp size={14} className="text-gray-400 ml-auto" /> : <ChevronDown size={14} className="text-gray-400 ml-auto" />}
                  </button>
                </div>
                {isExpanded && (
                  <div className="ml-8 space-y-0.5 pb-1">
                    {names.map(name => (
                      <button
                        key={name}
                        onClick={() => onToggleOrg(name)}
                        className="flex items-center gap-2.5 w-full py-1.5 px-2 rounded-lg active:bg-gray-50 text-left"
                      >
                        <span
                          className="w-4 h-4 rounded flex items-center justify-center border-2 shrink-0"
                          style={{
                            backgroundColor: filterOrgs.has(name) ? color : 'transparent',
                            borderColor: filterOrgs.has(name) ? color : '#d1d5db',
                          }}
                        >
                          {filterOrgs.has(name) && (
                            <svg width={10} height={10} viewBox="0 0 12 12" fill="none">
                              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span className="text-xs text-gray-600">{name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* 未分類 */}
          <button
            onClick={() => onToggleOrg('__未分類__')}
            className="flex items-center gap-3 w-full py-2.5 px-2 rounded-lg active:bg-gray-100 transition-colors border-t border-gray-100 mt-1 pt-3"
          >
            <span
              className="w-5 h-5 rounded flex items-center justify-center border-2 shrink-0"
              style={{
                backgroundColor: filterOrgs.has('__未分類__') ? '#6b7280' : 'transparent',
                borderColor: filterOrgs.has('__未分類__') ? '#6b7280' : '#d1d5db',
              }}
            >
              {filterOrgs.has('__未分類__') && (
                <svg width={12} height={12} viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className="text-sm text-gray-500">未分類</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}
