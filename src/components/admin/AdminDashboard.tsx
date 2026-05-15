import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Settings, LogOut, Plus, Trash2, X, Users } from 'lucide-react';
import Calendar from '../Calendar';
import BookingForm from '../BookingForm';
import { Booking, BookingStatus, RoomType, BookingRequest, CalendarEvent, OrgEntry } from '../../types';
import { ROOMS, TIME_SLOTS, shortRoomName } from '../../constants';

type Tab = 'calendar' | 'organizations' | 'settings';

interface Org {
  id: string;
  name: string;
  category: string;
  passcode: string | null;
  contact_email: string | null;
  registration_no: string | null;
  furigana: string | null;
  representative: string | null;
  han_ko: string | null;
  phone: string | null;
  activity_description: string | null;
  has_monthly_fee: boolean;
  registration_date: string | null;
  default_equipment: string[];
  presets: string[];
}

interface Category {
  id: string;
  name: string;
  tier: string;
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

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [tab, setTab] = useState<Tab>('calendar');
  const [loading, setLoading] = useState(false);

  // === カレンダー ===
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ room: RoomType; start: string; end: string } | null>(null);
  const [orgsByCategory, setOrgsByCategory] = useState<Record<string, OrgEntry[]>>({});

  const fetchEvents = useCallback(async (year: number, month: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar?year=${year}&month=${month + 1}`);
      if (!res.ok) throw new Error('API error');
      const events: CalendarEvent[] = await res.json();
      setBookings(events.map(evt => ({
        id: evt.id, date: evt.date, startTime: evt.startTime, endTime: evt.endTime,
        room: evt.room ?? RoomType.KAIGISHITSU, title: evt.summary, status: BookingStatus.CONFIRMED,
      })));
    } catch (err) {
      console.error('カレンダー取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(currentDate.getFullYear(), currentDate.getMonth());
  }, [currentDate, fetchEvents]);

  useEffect(() => {
    fetch(`/api/holidays?year=${new Date().getFullYear()}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: { date: string; name: string }[]) => {
        const map: Record<string, string> = {};
        data.forEach(h => { map[h.date] = h.name; });
        setHolidays(map);
      }).catch(() => {});

    fetch('/api/masters').then(r => r.ok ? r.json() : null).then(data => {
      if (data?.orgs) setOrgsByCategory(data.orgs);
    }).catch(() => {});
  }, []);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedSlot({ room: RoomType.KAIGISHITSU, start: '09:00', end: '12:00' });
    setShowBookingForm(true);
  };

  const handleBookingSubmit = async (data: BookingRequest) => {
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('保存エラー');
      setShowBookingForm(false);
      fetchEvents(currentDate.getFullYear(), currentDate.getMonth());
    } catch (err) {
      console.error('保存エラー:', err);
      alert('保存に失敗しました');
    }
  };

  // === 団体マスタ ===
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editOrg, setEditOrg] = useState<Org | null>(null);
  const [showOrgPanel, setShowOrgPanel] = useState(false);
  const [orgForm, setOrgForm] = useState({
    name: '', furigana: '', category: '2', passcode: '', contact_email: '',
    registration_no: '', representative: '', han_ko: '', phone: '',
    activity_description: '', has_monthly_fee: false, registration_date: '',
    default_equipment: [] as string[], presets: [] as string[],
  });

  useEffect(() => {
    supaFetch('booking_usage_categories?order=sort_order.asc&select=*')
      .then(r => r.json()).then(data => setCategories(data || []));
  }, []);

  const fetchOrgs = () => {
    setLoading(true);
    supaFetch('booking_organizations?order=category.asc,name.asc&select=*')
      .then(r => r.json()).then(data => setOrgs(data || []))
      .finally(() => setLoading(false));
  };
  useEffect(() => { if (tab === 'organizations') fetchOrgs(); }, [tab]);

  const openOrgForm = (org?: Org) => {
    if (org) {
      setEditOrg(org);
      setOrgForm({
        name: org.name, furigana: org.furigana || '', category: org.category,
        passcode: org.passcode || '', contact_email: org.contact_email || '',
        registration_no: org.registration_no || '', representative: org.representative || '',
        han_ko: org.han_ko || '', phone: org.phone || '',
        activity_description: org.activity_description || '',
        has_monthly_fee: org.has_monthly_fee || false,
        registration_date: org.registration_date || '',
        default_equipment: org.default_equipment || [], presets: org.presets || [],
      });
    } else {
      setEditOrg(null);
      setOrgForm({
        name: '', furigana: '', category: '2', passcode: '', contact_email: '',
        registration_no: '', representative: '', han_ko: '', phone: '',
        activity_description: '', has_monthly_fee: false, registration_date: '',
        default_equipment: [], presets: [],
      });
    }
    setShowOrgPanel(true);
  };

  const handleSaveOrg = async () => {
    if (!orgForm.name.trim()) return alert('団体名を入力してください');
    const body = {
      name: orgForm.name.trim(), furigana: orgForm.furigana || null,
      category: orgForm.category, passcode: orgForm.passcode || null,
      contact_email: orgForm.contact_email || null,
      registration_no: orgForm.registration_no || null,
      representative: orgForm.representative || null,
      han_ko: orgForm.han_ko || null, phone: orgForm.phone || null,
      activity_description: orgForm.activity_description || null,
      has_monthly_fee: orgForm.has_monthly_fee,
      registration_date: orgForm.registration_date || null,
      default_equipment: orgForm.default_equipment, presets: orgForm.presets,
    };
    if (editOrg) {
      await supaFetch(`booking_organizations?id=eq.${editOrg.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    } else {
      await supaFetch('booking_organizations', { method: 'POST', body: JSON.stringify(body) });
    }
    setShowOrgPanel(false);
    fetchOrgs();
  };

  const handleDeleteOrg = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    await supaFetch(`booking_organizations?id=eq.${id}`, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
    setOrgs(prev => prev.filter(o => o.id !== id));
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'calendar', label: 'カレンダー', icon: <CalendarDays size={18} /> },
    { id: 'organizations', label: '団体マスタ', icon: <Users size={18} /> },
    { id: 'settings', label: '設定', icon: <Settings size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-bold">事務局管理画面</h1>
            <div className="flex gap-1">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    tab === t.id ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >{t.icon} {t.label}</button>
              ))}
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white"><LogOut size={16} /> ログアウト</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        {/* === カレンダー === */}
        {tab === 'calendar' && (
          <Calendar
            currentDate={currentDate}
            onPrevMonth={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
            onNextMonth={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
            bookings={bookings}
            onDateClick={handleDateClick}
            holidays={holidays}
            loading={loading}
          />
        )}

        {/* === 団体マスタ === */}
        {tab === 'organizations' && (
          <div className="flex gap-4">
            <div className={`space-y-4 ${showOrgPanel ? 'w-1/2' : 'w-full'} transition-all`}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">団体マスタ</h2>
                <button onClick={() => openOrgForm()} className="flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">
                  <Plus size={16} /> 新規登録
                </button>
              </div>
              {loading ? <p className="text-gray-400 text-sm">読み込み中...</p> : orgs.length === 0 ? <p className="text-gray-400 text-sm">団体はありません</p> : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-500">団体名</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-500">代表者</th>
                        <th className="text-left px-3 py-2 font-medium text-gray-500">区分</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {orgs.map(o => (
                        <tr key={o.id} className={`cursor-pointer transition-colors ${editOrg?.id === o.id ? 'bg-emerald-50' : 'hover:bg-gray-50'}`} onClick={() => openOrgForm(o)}>
                          <td className="px-3 py-2 font-medium">{o.name}</td>
                          <td className="px-3 py-2 text-gray-500">{o.representative || '—'}</td>
                          <td className="px-3 py-2 text-xs">{categories.find(c => c.tier === o.category)?.name || o.category}</td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={e => { e.stopPropagation(); handleDeleteOrg(o.id, o.name); }} className="text-xs text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {showOrgPanel && (
              <div className="w-1/2 bg-white rounded-xl border border-gray-200 p-5 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold">{editOrg ? '団体を編集' : '新規団体登録'}</h3>
                  <button onClick={() => setShowOrgPanel(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={18} className="text-gray-400" /></button>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-medium text-gray-500 mb-1">登録No.</label><input value={orgForm.registration_no} onChange={e => setOrgForm(f => ({ ...f, registration_no: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                    <div><label className="block text-xs font-medium text-gray-500 mb-1">登録年月日</label><input type="date" value={orgForm.registration_date} onChange={e => setOrgForm(f => ({ ...f, registration_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                  </div>
                  <div><label className="block text-xs font-medium text-gray-500 mb-1">団体名 *</label><input value={orgForm.name} onChange={e => setOrgForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                  <div><label className="block text-xs font-medium text-gray-500 mb-1">フリガナ</label><input value={orgForm.furigana} onChange={e => setOrgForm(f => ({ ...f, furigana: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-medium text-gray-500 mb-1">代表者名</label><input value={orgForm.representative} onChange={e => setOrgForm(f => ({ ...f, representative: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                    <div><label className="block text-xs font-medium text-gray-500 mb-1">班－戸番</label><input value={orgForm.han_ko} onChange={e => setOrgForm(f => ({ ...f, han_ko: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="例: 3-12" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-medium text-gray-500 mb-1">電話番号</label><input value={orgForm.phone} onChange={e => setOrgForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                    <div><label className="block text-xs font-medium text-gray-500 mb-1">メールアドレス</label><input type="email" value={orgForm.contact_email} onChange={e => setOrgForm(f => ({ ...f, contact_email: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                  </div>
                  <div><label className="block text-xs font-medium text-gray-500 mb-1">利用区分</label><select value={orgForm.category} onChange={e => setOrgForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg">{categories.map(c => <option key={c.tier} value={c.tier}>{c.name}</option>)}</select></div>
                  <div><label className="block text-xs font-medium text-gray-500 mb-1">活動内容</label><textarea value={orgForm.activity_description} onChange={e => setOrgForm(f => ({ ...f, activity_description: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} /></div>
                  <div className="flex items-center gap-2"><input type="checkbox" id="monthly_fee" checked={orgForm.has_monthly_fee} onChange={e => setOrgForm(f => ({ ...f, has_monthly_fee: e.target.checked }))} className="rounded" /><label htmlFor="monthly_fee" className="text-xs text-gray-600">月謝あり</label></div>
                  <div><label className="block text-xs font-medium text-gray-500 mb-1">パスコード</label><input value={orgForm.passcode} onChange={e => setOrgForm(f => ({ ...f, passcode: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono" placeholder="4桁の数字など" /></div>
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => setShowOrgPanel(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50">キャンセル</button>
                  <button onClick={handleSaveOrg} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">{editOrg ? '更新' : '登録'}</button>
                </div>
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

      {/* 予約フォームモーダル */}
      {showBookingForm && selectedDate && selectedSlot && (
        <BookingForm
          selectedDate={selectedDate}
          initialRoom={selectedSlot.room}
          initialStartTime={selectedSlot.start}
          initialEndTime={selectedSlot.end}
          onCancel={() => setShowBookingForm(false)}
          onSubmit={handleBookingSubmit}
          orgsByCategory={orgsByCategory}
          submitting={false}
        />
      )}
    </div>
  );
}
