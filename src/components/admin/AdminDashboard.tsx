import { useState, useEffect } from 'react';
import { CalendarDays, ClipboardList, Settings, LogOut, Plus, Pencil, Trash2, X, Users } from 'lucide-react';
import { shortRoomName } from '../../constants';

type Tab = 'bookings' | 'organizations' | 'settings';

interface Org {
  id: string;
  name: string;
  category: string;
  passcode: string | null;
  contact_email: string | null;
}

interface AdminDashboardProps {
  onLogout: () => void;
}

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

const CATEGORIES = [
  { id: '1', name: '① 自治会運営' },
  { id: '2', name: '② 趣味・同好会' },
  { id: '3', name: '③ 混成団体・教室' },
  { id: '4', name: '④ 弔事' },
  { id: '5', name: '⑤ その他' },
];

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [tab, setTab] = useState<Tab>('bookings');
  const [bookings, setBookings] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(false);
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // 団体編集モーダル
  const [editOrg, setEditOrg] = useState<Org | null>(null);
  const [orgForm, setOrgForm] = useState({ name: '', category: '2', passcode: '', contact_email: '' });
  const [showOrgForm, setShowOrgForm] = useState(false);

  // 予約一覧取得
  useEffect(() => {
    if (tab !== 'bookings') return;
    setLoading(true);
    const [y, m] = monthFilter.split('-').map(Number);
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    supaFetch(`bookings?date=gte.${start}&date=lt.${end}&order=date.asc,slot.asc,room.asc&select=*`)
      .then(r => r.json())
      .then(data => setBookings(data || []))
      .finally(() => setLoading(false));
  }, [tab, monthFilter]);

  // 団体一覧取得
  const fetchOrgs = () => {
    setLoading(true);
    supaFetch('booking_organizations?order=category.asc,name.asc&select=*')
      .then(r => r.json())
      .then(data => setOrgs(data || []))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (tab === 'organizations') fetchOrgs(); }, [tab]);

  // 予約削除
  const handleDeleteBooking = async (id: string) => {
    if (!confirm('この予約を削除しますか？')) return;
    await supaFetch(`bookings?id=eq.${id}`, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
    setBookings(prev => prev.filter(b => b.id !== id));
  };

  // 団体フォームを開く
  const openOrgForm = (org?: Org) => {
    if (org) {
      setEditOrg(org);
      setOrgForm({ name: org.name, category: org.category, passcode: org.passcode || '', contact_email: org.contact_email || '' });
    } else {
      setEditOrg(null);
      setOrgForm({ name: '', category: '2', passcode: '', contact_email: '' });
    }
    setShowOrgForm(true);
  };

  // 団体保存
  const handleSaveOrg = async () => {
    if (!orgForm.name.trim()) return alert('団体名を入力してください');
    const body = {
      name: orgForm.name.trim(),
      category: orgForm.category,
      passcode: orgForm.passcode || null,
      contact_email: orgForm.contact_email || null,
    };
    if (editOrg) {
      await supaFetch(`booking_organizations?id=eq.${editOrg.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    } else {
      await supaFetch('booking_organizations', { method: 'POST', body: JSON.stringify(body) });
    }
    setShowOrgForm(false);
    fetchOrgs();
  };

  // 団体削除
  const handleDeleteOrg = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    await supaFetch(`booking_organizations?id=eq.${id}`, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
    setOrgs(prev => prev.filter(o => o.id !== id));
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'bookings', label: '予約一覧', icon: <ClipboardList size={18} /> },
    { id: 'organizations', label: '団体マスタ', icon: <Users size={18} /> },
    { id: 'settings', label: '設定', icon: <Settings size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-800 text-white sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-bold">事務局管理画面</h1>
            <div className="flex gap-1">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === t.id ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors">
            <LogOut size={16} /> ログアウト
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        {/* === 予約一覧 === */}
        {tab === 'bookings' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">予約一覧</h2>
              <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            {loading ? <p className="text-gray-400 text-sm">読み込み中...</p> : bookings.length === 0 ? <p className="text-gray-400 text-sm">この月の予約はありません</p> : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-500">日付</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500">時間帯</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500">部屋</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500">タイトル</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500">状態</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bookings.map((b: any) => (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2">{b.date}</td>
                        <td className="px-4 py-2">{b.slot}</td>
                        <td className="px-4 py-2">{shortRoomName(b.room)}</td>
                        <td className="px-4 py-2 font-medium">{b.title}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            b.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' :
                            b.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>{b.status === 'CONFIRMED' ? '確定' : b.status === 'PENDING' ? '承認待' : b.status}</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => handleDeleteBooking(b.id)} className="text-xs text-red-400 hover:text-red-600">削除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* === 団体マスタ === */}
        {tab === 'organizations' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-800">団体マスタ</h2>
              <button onClick={() => openOrgForm()} className="flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors">
                <Plus size={16} /> 新規登録
              </button>
            </div>
            {loading ? <p className="text-gray-400 text-sm">読み込み中...</p> : orgs.length === 0 ? <p className="text-gray-400 text-sm">登録されている団体はありません</p> : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-500">団体名</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500">区分</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500">パスコード</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500">メール</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orgs.map(o => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{o.name}</td>
                        <td className="px-4 py-2">{CATEGORIES.find(c => c.id === o.category)?.name || o.category}</td>
                        <td className="px-4 py-2 font-mono text-gray-500">{o.passcode || '—'}</td>
                        <td className="px-4 py-2 text-gray-500">{o.contact_email || '—'}</td>
                        <td className="px-4 py-2 text-right space-x-2">
                          <button onClick={() => openOrgForm(o)} className="text-xs text-blue-500 hover:text-blue-700"><Pencil size={14} className="inline" /></button>
                          <button onClick={() => handleDeleteOrg(o.id, o.name)} className="text-xs text-red-400 hover:text-red-600"><Trash2 size={14} className="inline" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* === 設定 === */}
        {tab === 'settings' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800">設定</h2>
            <p className="text-gray-400 text-sm">部屋マスタ・設備マスタ・時間帯設定は今後実装予定です。</p>
          </div>
        )}
      </main>

      {/* === 団体フォームモーダル === */}
      {showOrgForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowOrgForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{editOrg ? '団体を編集' : '新規団体登録'}</h3>
              <button onClick={() => setShowOrgForm(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">団体名 *</label>
                <input value={orgForm.name} onChange={e => setOrgForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">利用区分</label>
                <select value={orgForm.category} onChange={e => setOrgForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base">
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">パスコード</label>
                <input value={orgForm.passcode} onChange={e => setOrgForm(f => ({ ...f, passcode: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base font-mono" placeholder="4桁の数字など" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">連絡先メール</label>
                <input type="email" value={orgForm.contact_email} onChange={e => setOrgForm(f => ({ ...f, contact_email: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base" placeholder="example@mail.com" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowOrgForm(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50">キャンセル</button>
              <button onClick={handleSaveOrg} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">{editOrg ? '更新' : '登録'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
