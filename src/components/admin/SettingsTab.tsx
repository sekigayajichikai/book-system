import { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, Check, X, ChevronUp, ChevronDown } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

async function supaFetch(path: string, options?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options?.headers || {}),
    },
  });
}

interface MasterItem {
  id: string;
  [key: string]: any;
}

interface Category {
  id: string;
  name: string;
  tier: string;
}

/** 汎用マスタ編集セクション */
function MasterSection<T extends MasterItem>({
  title, table, items, setItems, columns, defaultRow,
}: {
  title: string;
  table: string;
  items: T[];
  setItems: (items: T[]) => void;
  columns: { key: string; label: string; type?: 'text' | 'number'; width?: string }[];
  defaultRow: Omit<T, 'id'>;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const fetchItems = () => {
    supaFetch(`${table}?order=sort_order.asc&select=*`)
      .then(r => r.json()).then(data => setItems(data || []));
  };

  useEffect(() => { fetchItems(); }, []);

  const startEdit = (item: T) => {
    setEditId(item.id);
    const f: Record<string, any> = {};
    columns.forEach(c => { f[c.key] = item[c.key] ?? ''; });
    setForm(f);
  };

  const startAdd = () => {
    setEditId('new');
    const f: Record<string, any> = {};
    columns.forEach(c => { f[c.key] = (defaultRow as any)[c.key] ?? ''; });
    setForm(f);
  };

  const handleSave = async () => {
    const body: Record<string, any> = {};
    columns.forEach(c => {
      body[c.key] = c.type === 'number' ? Number(form[c.key]) : form[c.key];
    });
    if (body.sort_order === undefined || body.sort_order === null || body.sort_order === '') body.sort_order = items.length + 1;

    if (editId === 'new') {
      await supaFetch(table, { method: 'POST', body: JSON.stringify(body) });
    } else {
      await supaFetch(`${table}?id=eq.${editId}`, { method: 'PATCH', body: JSON.stringify(body) });
    }
    setEditId(null);
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('削除しますか？')) return;
    await supaFetch(`${table}?id=eq.${id}`, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
    fetchItems();
  };

  const handleSwap = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const a = items[index];
    const b = items[targetIndex];
    await Promise.all([
      supaFetch(`${table}?id=eq.${a.id}`, { method: 'PATCH', body: JSON.stringify({ sort_order: b.sort_order }) }),
      supaFetch(`${table}?id=eq.${b.id}`, { method: 'PATCH', body: JSON.stringify({ sort_order: a.sort_order }) }),
    ]);
    fetchItems();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-700">{title}</h3>
        <button onClick={startAdd} className="flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700">
          <Plus size={12} /> 追加
        </button>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm table-auto">
          <thead className="bg-gray-50">
            <tr>
              {columns.map(c => (
                <th key={c.key} className={`px-3 py-2 font-medium text-gray-500 text-xs whitespace-nowrap ${c.width ? 'text-center' : 'text-left'}`} style={c.width ? { width: c.width, minWidth: c.width } : {}}>{c.label}</th>
              ))}
              <th className="px-3 py-2 w-28"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, idx) => (
              <tr key={item.id} className="hover:bg-gray-50">
                {editId === item.id ? (
                  <>
                    {columns.map(c => (
                      <td key={c.key} className="px-3 py-1.5">
                        <input
                          value={form[c.key] ?? ''}
                          onChange={e => setForm(f => ({ ...f, [c.key]: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm min-w-[70px]"
                          type={c.type === 'number' ? 'number' : 'text'}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right space-x-1 whitespace-nowrap">
                      <button onClick={handleSave} className="text-emerald-600 hover:text-emerald-800"><Check size={14} /></button>
                      <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                    </td>
                  </>
                ) : (
                  <>
                    {columns.map(c => (
                      <td key={c.key} className={`px-3 py-2 ${c.width ? 'text-center' : ''}`}>{(() => { const v = String(item[c.key] ?? ''); return /^\d{2}:\d{2}:\d{2}$/.test(v) ? v.slice(0, 5) : v; })()}</td>
                    ))}
                    <td className="px-3 py-2 text-right whitespace-nowrap flex items-center justify-end gap-2">
                      <button onClick={() => handleSwap(idx, 'up')} disabled={idx === 0} className={`${idx === 0 ? 'text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}><ChevronUp size={14} /></button>
                      <button onClick={() => handleSwap(idx, 'down')} disabled={idx === items.length - 1} className={`${idx === items.length - 1 ? 'text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}><ChevronDown size={14} /></button>
                      <button onClick={() => startEdit(item)} className="text-blue-400 hover:text-blue-600"><Pencil size={14} /></button>
                      <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {editId === 'new' && (
              <tr className="bg-emerald-50">
                {columns.map(c => (
                  <td key={c.key} className="px-3 py-1.5">
                    <input
                      value={form[c.key] ?? ''}
                      onChange={e => setForm(f => ({ ...f, [c.key]: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm min-w-[70px]"
                      type={c.type === 'number' ? 'number' : 'text'}
                    />
                  </td>
                ))}
                <td className="px-3 py-1.5 text-right space-x-1 whitespace-nowrap">
                  <button onClick={handleSave} className="text-emerald-600 hover:text-emerald-800"><Check size={14} /></button>
                  <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface SettingsTabProps {
  categories: Category[];
  onCategoriesChange: (c: Category[]) => void;
}

export default function SettingsTab({ categories, onCategoriesChange }: SettingsTabProps) {
  const [orgGroups, setOrgGroups] = useState<MasterItem[]>([]);
  const [rooms, setRooms] = useState<MasterItem[]>([]);
  const [equipment, setEquipment] = useState<MasterItem[]>([]);
  const [timeSlots, setTimeSlots] = useState<MasterItem[]>([]);
  const [cats, setCats] = useState<MasterItem[]>([]);

  // カテゴリ変更を親に伝播
  useEffect(() => {
    if (cats.length > 0) onCategoriesChange(cats as any);
  }, [cats]);

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-bold text-gray-800">設定</h2>

      {/* ===== 共通 ===== */}
      <div className="border-l-4 border-gray-400 pl-4 space-y-6">
        <h3 className="text-sm font-bold text-gray-700">共通</h3>

        <MasterSection
          title="団体カテゴリ"
          table="booking_org_groups"
          items={orgGroups}
          setItems={setOrgGroups}
          columns={[
            { key: 'name', label: 'カテゴリ名' },
            { key: 'default_tier', label: 'デフォルト利用区分', width: '120px' },
            { key: 'sort_order', label: '順', type: 'number', width: '80px' },
          ]}
          defaultRow={{ name: '', default_tier: '1', sort_order: 0 }}
        />

        <MasterSection
          title="利用区分マスタ"
          table="booking_usage_categories"
          items={cats}
          setItems={setCats}
          columns={[
            { key: 'name', label: '区分名' },
            { key: 'price_large', label: '会議室(円)', type: 'number', width: '80px' },
            { key: 'price_small', label: '和室等(円)', type: 'number', width: '80px' },
            { key: 'sort_order', label: '順', type: 'number', width: '80px' },
          ]}
          defaultRow={{ name: '', tier: '', price_type: 'other', price_large: 0, price_small: 0, sort_order: 0 }}
        />
      </div>

      {/* ===== 会館予約 ===== */}
      <div className="border-l-4 border-blue-400 pl-4 space-y-6">
        <h3 className="text-sm font-bold text-blue-700">会館予約</h3>

        <MasterSection
          title="部屋マスタ"
          table="booking_rooms"
          items={rooms}
          setItems={setRooms}
          columns={[
            { key: 'name', label: '部屋名' },
            { key: 'short_name', label: '略称' },
            { key: 'capacity', label: '定員', type: 'number', width: '80px' },
            { key: 'sort_order', label: '順', type: 'number', width: '80px' },
          ]}
          defaultRow={{ name: '', short_name: '', capacity: 0, description: '', sort_order: 0 }}
        />

        <MasterSection
          title="時間帯マスタ"
          table="booking_time_slots"
          items={timeSlots}
          setItems={setTimeSlots}
          columns={[
            { key: 'slot_key', label: 'キー' },
            { key: 'label', label: '表示名' },
            { key: 'start_time', label: '開始' },
            { key: 'end_time', label: '終了' },
            { key: 'sort_order', label: '順', type: 'number', width: '80px' },
          ]}
          defaultRow={{ slot_key: '', label: '', start_time: '09:00', end_time: '12:00', sort_order: 0 }}
        />

        <MasterSection
          title="設備マスタ"
          table="booking_equipment"
          items={equipment}
          setItems={setEquipment}
          columns={[
            { key: 'name', label: '設備名' },
            { key: 'price', label: '料金', type: 'number', width: '80px' },
            { key: 'sort_order', label: '順', type: 'number', width: '80px' },
          ]}
          defaultRow={{ name: '', price: 300, sort_order: 0 }}
        />
      </div>

    </div>
  );
}
