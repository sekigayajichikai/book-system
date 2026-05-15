import { useState, useEffect } from 'react';
import { CalendarDays, ClipboardList, Settings, LogOut, Plus } from 'lucide-react';
import { Booking } from '../../types';
import { ROOMS, TIME_SLOTS, shortRoomName } from '../../constants';

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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  return res;
}

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [tab, setTab] = useState<Tab>('bookings');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(false);
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

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
  useEffect(() => {
    if (tab !== 'organizations') return;
    setLoading(true);
    supaFetch('booking_organizations?order=category.asc,name.asc&select=*')
      .then(r => r.json())
      .then(data => setOrgs(data || []))
      .finally(() => setLoading(false));
  }, [tab]);

  // 予約削除
  const handleDeleteBooking = async (id: string) => {
    if (!confirm('この予約を削除しますか？')) return;
    await supaFetch(`bookings?id=eq.${id}`, {
      method: 'DELETE',
      headers: { 'Prefer': 'return=minimal' },
    });
    setBookings(prev => prev.filter(b => b.id !== id));
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'bookings', label: '予約一覧', icon: <ClipboardList size={18} /> },
    { id: 'organizations', label: '団体マスタ', icon: <CalendarDays size={18} /> },
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
          <button
            onClick={onLogout}
            className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
          >
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
              <input
                type="month"
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            {loading ? (
              <p className="text-gray-400 text-sm">読み込み中...</p>
            ) : bookings.length === 0 ? (
              <p className="text-gray-400 text-sm">この月の予約はありません</p>
            ) : (
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
                          <button
                            onClick={() => handleDeleteBooking(b.id)}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            削除
                          </button>
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
            </div>

            {loading ? (
              <p className="text-gray-400 text-sm">読み込み中...</p>
            ) : orgs.length === 0 ? (
              <p className="text-gray-400 text-sm">登録されている団体はありません</p>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-500">団体名</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500">区分</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500">パスコード</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500">メール</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orgs.map(o => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{o.name}</td>
                        <td className="px-4 py-2">{o.category}</td>
                        <td className="px-4 py-2 font-mono text-gray-500">{o.passcode || '—'}</td>
                        <td className="px-4 py-2 text-gray-500">{o.contact_email || '—'}</td>
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
    </div>
  );
}
