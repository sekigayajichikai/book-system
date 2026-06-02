import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, ClipboardList, Settings, LogOut, Plus, Trash2, Pencil, X, Users, Check, Upload, List } from 'lucide-react';
import Calendar from '../Calendar';
import EventList from '../EventList';
import AdminDayPanel from './AdminDayPanel';
import SettingsTab from './SettingsTab';
import ImportTab from './ImportTab';
import DetailPopover, { DetailData } from './DetailPopover';
import { EventCreatePopover, BookingCreatePopover } from './QuickCreatePopover';
import Popover from './Popover';
import { Booking, BookingStatus, RoomType, CalendarEvent, EventSummary, OrgEntry } from '../../types';
import { ROOMS, TIME_SLOTS, shortRoomName } from '../../constants';

type Tab = 'calendar' | 'import' | 'approvals' | 'organizations' | 'settings';

interface Org {
  id: string;
  name: string;
  category: string;
  passcode: string | null;
  contact_email: string | null;
  registration_no: string | null;
  furigana: string | null;
  representative: string | null;
  rep_last_name: string | null;
  rep_first_name: string | null;
  rep_last_name_kana: string | null;
  rep_first_name_kana: string | null;
  han_ko: string | null;
  phone: string | null;
  activity_description: string | null;
  has_monthly_fee: boolean;
  registration_date: string | null;
  default_equipment: string[];
  presets: string[];
  group_name: string | null;
  is_active: boolean | null;
  created_at: string;
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
  const [tab, setTabState] = useState<Tab>(() => (localStorage.getItem('admin_tab') as Tab) || 'calendar');
  const setTab = (t: Tab) => { setTabState(t); localStorage.setItem('admin_tab', t); };
  const [calendarSubView, setCalendarSubViewState] = useState<'schedule' | 'facility'>(() => (localStorage.getItem('admin_cal_sub') as 'schedule' | 'facility') || 'schedule');
  const setCalendarSubView = (v: 'schedule' | 'facility') => { setCalendarSubViewState(v); localStorage.setItem('admin_cal_sub', v); };
  const [loading, setLoading] = useState(false);

  // === カレンダー ===
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [closures, setClosures] = useState<Set<string>>(new Set());

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

    supaFetch('calendar_events?is_closure=eq.true&select=date')
      .then(r => r.json())
      .then((data: { date: string }[]) => setClosures(new Set(data.map(d => d.date))))
      .catch(() => {});
  }, []);

  const [showDayPanel, setShowDayPanel] = useState(false);
  const [initialEditId, setInitialEditId] = useState<string | null>(null);
  const [initialEditBookingId, setInitialEditBookingId] = useState<string | null>(null);
  const [eventListRefreshKey, setEventListRefreshKey] = useState(0);

  // ポップオーバー状態
  type PopoverState = {
    type: 'create' | 'detail' | 'list';
    anchorRect: { top: number; left: number; width: number; height: number };
    date?: Date;
    data?: DetailData;
  } | null;
  const [popover, setPopover] = useState<PopoverState>(null);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowDayPanel(true);
  };

  // 空セルクリック → 作成ポップオーバー
  const handleCellClick = (date: Date, rect: DOMRect) => {
    setPopover({ type: 'create', anchorRect: rect, date });
  };

  // +Nクリック → 一覧ポップオーバー（DayDetailPopover相当）
  const handleOverflowClick = (date: Date, rect: DOMRect) => {
    setPopover({ type: 'list', anchorRect: rect, date });
  };

  // 予約アイテムクリック → 詳細ポップオーバー（org_idから団体名も取得）
  const handleBookingItemClick = async (booking: Booking, rect: DOMRect) => {
    const slot = booking.startTime === '09:00' ? '午前' : booking.startTime === '13:00' ? '午後' : '夜間';
    let orgName: string | null = null;
    try {
      const res = await supaFetch(`bookings?id=eq.${booking.id}&select=org_id,booking_organizations(name)`);
      const data = res.ok ? await res.json() : [];
      orgName = data[0]?.booking_organizations?.name || null;
    } catch {}
    setPopover({
      type: 'detail',
      anchorRect: rect,
      data: {
        type: 'booking', id: booking.id, title: booking.title, date: booking.date,
        room: booking.room, slot, startTime: booking.startTime, endTime: booking.endTime, orgName,
      },
    });
  };

  // イベントアイテムクリック → 詳細ポップオーバー
  const handleEventItemClick = (event: EventSummary, rect: DOMRect) => {
    setPopover({
      type: 'detail',
      anchorRect: rect,
      data: {
        type: 'event', id: event.id, title: event.title, date: event.date,
        location: event.location, startTime: event.startTime, endTime: event.endTime,
        memo: event.memo, description: event.description, eventType: event.eventType,
        isMajor: event.isMajor,
      },
    });
  };

  const closePopover = () => setPopover(null);

  const handleDayPanelRefresh = () => {
    fetchEvents(currentDate.getFullYear(), currentDate.getMonth());
    setEventListRefreshKey(k => k + 1);
  };

  // === 団体マスタ ===
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orgGroups, setOrgGroups] = useState<{ id: string; name: string; default_tier: string }[]>([]);
  const [equipmentList, setEquipmentList] = useState<{ id: string; name: string }[]>([]);
  const [editOrg, setEditOrg] = useState<Org | null>(null);
  const [orgEditing, setOrgEditing] = useState(false);
  const [showOrgPanel, setShowOrgPanel] = useState(false);
  const [orgSortByGroup, setOrgSortByGroup] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [orgLastUsed, setOrgLastUsed] = useState<Record<string, string>>({});
  const [orgForm, setOrgForm] = useState({
    name: '', furigana: '', category: '2', passcode: '', contact_email: '',
    registration_no: '', representative: '', rep_last_name: '', rep_first_name: '', rep_last_name_kana: '', rep_first_name_kana: '', han_ko: '', phone: '',
    activity_description: '', has_monthly_fee: false, registration_date: '',
    default_equipment: [] as string[], presets: [] as string[],
    group_name: '',
    keywords: [] as string[],
    notes: '',
  });

  useEffect(() => {
    supaFetch('booking_usage_categories?order=sort_order.asc&select=*')
      .then(r => r.json()).then(data => setCategories(data || []));
    supaFetch('booking_org_groups?order=sort_order.asc&select=*')
      .then(r => r.json()).then(data => setOrgGroups(data || []));
    supaFetch('booking_equipment?order=sort_order.asc&select=id,name')
      .then(r => r.json()).then(data => setEquipmentList(data || []));
  }, []);

  const fetchOrgs = (autoSelect?: boolean) => {
    setLoading(true);
    supaFetch('booking_organizations?order=name.asc&select=*')
      .then(r => r.json()).then(data => {
        setOrgs(data || []);
        if (autoSelect && data?.length > 0) openOrgForm(data[0]);
      })
      .finally(() => setLoading(false));

    // 各団体の最終利用日を取得（org_id紐づけ + タイトル部分一致で推定）
    supaFetch('bookings?select=org_id,title,date&order=date.desc')
      .then(r => r.json()).then((bookingData: any[]) => {
        supaFetch('booking_organizations?select=id,name')
          .then(r => r.json()).then((orgData: any[]) => {
            const map: Record<string, string> = {};
            // org_id紐づけ分
            (bookingData || []).forEach(b => {
              if (b.org_id && !map[b.org_id]) map[b.org_id] = b.date;
            });
            // タイトル部分一致で推定
            (orgData || []).forEach((org: any) => {
              if (map[org.id]) return; // 既にorg_idで判定済み
              const match = (bookingData || []).find((b: any) =>
                b.title && org.name && (b.title.includes(org.name) || org.name.includes(b.title))
              );
              if (match) map[org.id] = match.date;
            });
            setOrgLastUsed(map);
          });
      }).catch(() => {});
  };
  useEffect(() => { if (tab === 'organizations') fetchOrgs(true); }, [tab]);

  const openOrgForm = (org?: Org) => {
    if (org) {
      setEditOrg(org);
      setOrgForm({
        name: org.name, furigana: org.furigana || '', category: org.category,
        passcode: org.passcode || '', contact_email: org.contact_email || '',
        registration_no: org.registration_no || '', representative: org.representative || '',
        rep_last_name: org.rep_last_name || '', rep_first_name: org.rep_first_name || '',
        rep_last_name_kana: org.rep_last_name_kana || '', rep_first_name_kana: org.rep_first_name_kana || '',
        han_ko: org.han_ko || '', phone: org.phone || '',
        activity_description: org.activity_description || '',
        has_monthly_fee: org.has_monthly_fee || false,
        registration_date: org.registration_date || '',
        default_equipment: org.default_equipment || [], presets: org.presets || [],
        group_name: org.group_name || '',
        keywords: (org as any).keywords || [],
        notes: (org as any).notes || '',
      });
      setOrgEditing(false);
    } else {
      setEditOrg(null);
      setOrgEditing(true);
      setOrgForm({
        name: '', furigana: '', category: '2', passcode: '', contact_email: '',
        registration_no: '', representative: '', rep_last_name: '', rep_first_name: '', rep_last_name_kana: '', rep_first_name_kana: '', han_ko: '', phone: '',
        activity_description: '', has_monthly_fee: false, registration_date: '',
        default_equipment: [], presets: [], group_name: '', keywords: [], notes: '',
      });
    }
    setShowOrgPanel(true);
  };

  // 利用区分→大カテゴリ自動判定
  const guessGroupByCategory = (cat: string): string => {
    const group = orgGroups.find(g => g.default_tier === cat);
    return group?.name || '';
  };

  const handleCategoryChange = (cat: string) => {
    setOrgForm(f => ({
      ...f,
      category: cat,
      group_name: f.group_name || guessGroupByCategory(cat),
    }));
  };

  // 全角→半角変換
  const toHalf = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/ー/g, '-').replace(/　/g, ' ');
  // ひらがな→カタカナ
  const toKatakana = (s: string) => s.replace(/[\u3041-\u3096]/g, c => String.fromCharCode(c.charCodeAt(0) + 96));

  const handleSaveOrg = async () => {
    if (!orgForm.name.trim()) return alert('団体名を入力してください');
    if (!orgForm.group_name) return alert('大カテゴリを選択してください');
    const duplicate = orgs.find(o => o.name === orgForm.name.trim() && o.id !== editOrg?.id);
    if (duplicate) return alert(`「${orgForm.name.trim()}」は既に登録されています。別の名前にしてください。`);
    const body = {
      name: orgForm.name.trim(),
      furigana: orgForm.furigana ? toKatakana(orgForm.furigana.trim()) : null,
      category: orgForm.category,
      passcode: orgForm.passcode ? toHalf(orgForm.passcode.trim()) : null,
      contact_email: orgForm.contact_email ? orgForm.contact_email.trim().toLowerCase() : null,
      registration_no: orgForm.registration_no ? toHalf(orgForm.registration_no.trim()) : null,
      representative: [orgForm.rep_last_name, orgForm.rep_first_name].filter(Boolean).join(' ').trim() || null,
      rep_last_name: orgForm.rep_last_name?.trim() || null,
      rep_first_name: orgForm.rep_first_name?.trim() || null,
      rep_last_name_kana: orgForm.rep_last_name_kana ? toKatakana(orgForm.rep_last_name_kana.trim()) : null,
      rep_first_name_kana: orgForm.rep_first_name_kana ? toKatakana(orgForm.rep_first_name_kana.trim()) : null,
      han_ko: orgForm.han_ko ? toHalf(orgForm.han_ko.trim()) : null,
      phone: orgForm.phone ? toHalf(orgForm.phone.trim()).replace(/[-\s]/g, '') : null,
      activity_description: orgForm.activity_description?.trim() || null,
      has_monthly_fee: orgForm.has_monthly_fee,
      registration_date: orgForm.registration_date || null,
      default_equipment: orgForm.default_equipment, presets: orgForm.presets,
      group_name: orgForm.group_name || null,
      keywords: orgForm.keywords || [],
      notes: orgForm.notes?.trim() || null,
    };
    if (editOrg) {
      await supaFetch(`booking_organizations?id=eq.${editOrg.id}`, { method: 'PATCH', body: JSON.stringify(body) });
    } else {
      await supaFetch('booking_organizations', { method: 'POST', body: JSON.stringify(body) });
    }
    setOrgEditing(false);
    const savedId = editOrg?.id;
    const savedName = orgForm.name.trim();
    setLoading(true);
    supaFetch('booking_organizations?order=name.asc&select=*')
      .then(r => r.json()).then(data => {
        setOrgs(data || []);
        // 更新 or 新規登録した団体を再選択
        const found = (data || []).find((o: Org) => savedId ? o.id === savedId : o.name === savedName);
        if (found) openOrgForm(found);
      })
      .finally(() => setLoading(false));
  };

  const handleDeleteOrg = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    await supaFetch(`booking_organizations?id=eq.${id}`, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
    setOrgs(prev => prev.filter(o => o.id !== id));
  };

  // === 申請管理 ===
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== 'approvals') return;
    setLoading(true);
    supaFetch('bookings?status=eq.PENDING&order=date.asc&select=*')
      .then(r => r.json())
      .then(data => setPendingBookings(data || []))
      .finally(() => setLoading(false));
  }, [tab]);

  const handleApprove = async (id: string) => {
    await supaFetch(`bookings?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CONFIRMED', approved_at: new Date().toISOString() }),
    });
    setPendingBookings(prev => prev.filter(b => b.id !== id));
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) return alert('却下理由を入力してください');
    await supaFetch(`bookings?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'REJECTED', reject_reason: rejectReason.trim() }),
    });
    setPendingBookings(prev => prev.filter(b => b.id !== id));
    setRejectingId(null);
    setRejectReason('');
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'calendar', label: '予定管理', icon: <CalendarDays size={18} /> },
    { id: 'import', label: 'インポート', icon: <Upload size={18} /> },
    { id: 'approvals', label: `申請管理${pendingBookings.length > 0 ? ` (${pendingBookings.length})` : ''}`, icon: <ClipboardList size={18} /> },
    { id: 'organizations', label: '団体マスタ', icon: <Users size={18} /> },
    { id: 'settings', label: '設定', icon: <Settings size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-800 text-white sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-bold">管理画面</h1>
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
          <div className="space-y-4">
            {/* カレンダー/会館予約 切り替え */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCalendarSubView('schedule')}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all active:scale-95 ${
                    calendarSubView === 'schedule' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <List size={16} className="inline-block mr-1 -mt-0.5" />カレンダー
                </button>
                <button
                  onClick={() => setCalendarSubView('facility')}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all active:scale-95 ${
                    calendarSubView === 'facility' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <CalendarDays size={16} className="inline-block mr-1 -mt-0.5" />会館予約
                </button>
              </div>
            </div>

            {calendarSubView === 'schedule' ? (
              <EventList holidays={holidays} closures={closures} onCellClick={handleCellClick} onItemClick={handleEventItemClick} refreshKey={eventListRefreshKey} />
            ) : (
              <Calendar
                currentDate={currentDate}
                onPrevMonth={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                onNextMonth={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                bookings={bookings}
                onDateClick={handleDateClick}
                onCellClick={handleCellClick}
                onItemClick={handleBookingItemClick}
                onOverflowClick={handleOverflowClick}
                holidays={holidays}
                closures={closures}
                disableModal
                loading={loading}
              />
            )}
          </div>
        )}

        {/* === インポート === */}
        {tab === 'import' && <ImportTab />}

        {/* === 申請管理 === */}
        {tab === 'approvals' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-800">申請管理</h2>
            {loading ? <p className="text-gray-400 text-sm">読み込み中...</p> : pendingBookings.length === 0 ? (
              <p className="text-gray-400 text-sm">承認待ちの申請はありません</p>
            ) : (
              <div className="space-y-3">
                {pendingBookings.map((b: any) => (
                  <div key={b.id} className="bg-white rounded-xl border border-yellow-200 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-yellow-100 text-yellow-700">承認待ち</span>
                          <span className="text-sm text-gray-500">{b.date} {b.slot}</span>
                        </div>
                        <div className="text-base font-bold text-gray-800">{b.title}</div>
                        <div className="text-sm text-gray-500">{shortRoomName(b.room)}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(b.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700"
                        >
                          <Check size={14} /> 承認
                        </button>
                        <button
                          onClick={() => setRejectingId(rejectingId === b.id ? null : b.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100"
                        >
                          <X size={14} /> 却下
                        </button>
                      </div>
                    </div>
                    {rejectingId === b.id && (
                      <div className="mt-3 flex gap-2">
                        <input
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="却下理由を入力"
                          autoFocus
                        />
                        <button onClick={() => handleReject(b.id)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold">送信</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === 団体マスタ === */}
        {tab === 'organizations' && (
          <div className="flex gap-4">
            <div className={`${showOrgPanel ? 'w-1/3' : 'w-full max-w-sm'} transition-all`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-800">団体マスタ</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setOrgSortByGroup(!orgSortByGroup)}
                    className={`px-2 py-1 rounded text-xs font-bold ${orgSortByGroup ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {orgSortByGroup ? 'カテゴリ順' : '名前順'}
                  </button>
                  <button onClick={() => openOrgForm()} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">
                    <Plus size={14} /> 新規
                  </button>
                </div>
              </div>
              {loading ? <p className="text-gray-400 text-sm">読み込み中...</p> : orgs.length === 0 ? <p className="text-gray-400 text-sm">団体はありません</p> : (() => {
                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                const cutoff = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-${String(sixMonthsAgo.getDate()).padStart(2, '0')}`;

                const isOrgActive = (o: Org) => {
                  if (o.is_active === true) return true; // 常に表示
                  if (o.is_active === false) return false; // 非表示
                  // 自動判定 (null)
                  const last = orgLastUsed[o.id];
                  if (last && last >= cutoff) return true; // 直近6ヶ月に利用あり
                  if (o.created_at && o.created_at >= cutoff) return true; // 登録6ヶ月以内
                  return false;
                };
                const activeOrgs = orgs.filter(isOrgActive);
                const archivedOrgs = orgs.filter(o => !isOrgActive(o));

                const sortOrgs = (list: Org[]) => {
                  if (!orgSortByGroup) return [...list].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
                  const groupOrder = orgGroups.map(g => g.name);
                  return [...list].sort((a, b) => {
                    const ga = groupOrder.indexOf(a.group_name || '');
                    const gb = groupOrder.indexOf(b.group_name || '');
                    const ia = ga >= 0 ? ga : 999;
                    const ib = gb >= 0 ? gb : 999;
                    if (ia !== ib) return ia - ib;
                    return a.name.localeCompare(b.name, 'ja');
                  });
                };

                const sortedActive = sortOrgs(activeOrgs);
                const sortedArchived = sortOrgs(archivedOrgs);

                const groupColorsDef: [string[], { border: string; text: string; bg: string }][] = [
                  [['自治会'], { border: 'border-l-red-400', text: 'text-red-600', bg: 'bg-red-50' }],
                  [['委員会'], { border: 'border-l-blue-400', text: 'text-blue-600', bg: 'bg-blue-50' }],
                  [['自主活動部'], { border: 'border-l-emerald-400', text: 'text-emerald-600', bg: 'bg-emerald-50' }],
                  [['会員団体'], { border: 'border-l-amber-400', text: 'text-amber-600', bg: 'bg-amber-50' }],
                  [['一般団体', '一般'], { border: 'border-l-violet-400', text: 'text-violet-600', bg: 'bg-violet-50' }],
                  [['その他', 'その他/外部'], { border: 'border-l-gray-400', text: 'text-gray-500', bg: 'bg-gray-50' }],
                ];
                const groupColors: Record<string, { border: string; text: string; bg: string }> = {};
                groupColorsDef.forEach(([names, color]) => names.forEach(n => { groupColors[n] = color; }));
                const defaultColor = { border: 'border-gray-300', text: 'text-gray-500', bg: 'bg-gray-50' };

                let lastGroup = '';
                const renderOrgItem = (o: Org, showGroupHeader: boolean, isArchived?: boolean) => {
                  const gc = groupColors[o.group_name || ''] || defaultColor;
                  const groupHeader = orgSortByGroup && showGroupHeader ? (
                    <div className={`px-4 py-1.5 ${gc.bg} text-xs font-bold ${gc.text} border-b border-gray-100 border-l-4 ${gc.border}`}>
                      {o.group_name || '未分類'}
                    </div>
                  ) : null;

                  return (
                    <div key={o.id}>
                      {groupHeader}
                      <div
                        className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${editOrg?.id === o.id ? 'bg-slate-100' : 'hover:bg-gray-50'}`}
                        onClick={() => openOrgForm(o)}
                      >
                        <div>
                          <div className="text-sm font-bold text-gray-800">{o.name}</div>
                          {!orgSortByGroup && <div className="text-xs text-gray-400">{o.group_name || '未分類'}</div>}
                        </div>
                        <div className="flex items-center gap-1">
                          {isArchived && (
                            <button
                              title="常に表示にする"
                              onClick={async e => {
                                e.stopPropagation();
                                await supaFetch(`booking_organizations?id=eq.${o.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: true }) });
                                setOrgs(prev => prev.map(org => org.id === o.id ? { ...org, is_active: true } : org));
                              }}
                              className="text-xs text-blue-400 hover:text-blue-600 px-1"
                            >
                              表示
                            </button>
                          )}
                          </div>
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
                    {sortedActive.map(o => {
                      const group = o.group_name || '未分類';
                      const showHeader = orgSortByGroup && group !== lastGroup;
                      lastGroup = group;
                      return renderOrgItem(o, showHeader);
                    })}
                  </div>

                  {/* アーカイブ（6ヶ月以上利用なし） */}
                  {sortedArchived.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => setShowArchived(!showArchived)}
                        className="w-full text-xs text-gray-400 hover:text-gray-600 py-2 flex items-center justify-center gap-1"
                      >
                        {showArchived ? '▲' : '▼'} アーカイブ（{sortedArchived.length}件・6ヶ月以上利用なし）
                      </button>
                      {showArchived && (
                        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100 opacity-60">
                          {(() => { lastGroup = ''; return null; })()}
                          {sortedArchived.map(o => {
                            const group = o.group_name || '未分類';
                            const showHeader = orgSortByGroup && group !== lastGroup;
                            lastGroup = group;
                            return renderOrgItem(o, showHeader, true);
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  </>
                );
              })()}
            </div>

            {showOrgPanel && (
              <div className="w-2/3 bg-white rounded-xl border border-gray-200 p-6 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold">{!editOrg ? '新規団体登録' : orgEditing ? '団体を編集' : orgForm.name}</h3>
                  <div className="flex items-center gap-2">
                    {editOrg && !orgEditing && (
                      <>
                        <button onClick={() => setOrgEditing(true)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100"><Pencil size={12} /> 編集</button>
                        <button onClick={() => handleDeleteOrg(editOrg.id, editOrg.name)} className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-full"><Trash2 size={16} /></button>
                      </>
                    )}
                    {(!editOrg || orgEditing) && (
                      <>
                        <button onClick={() => editOrg ? setOrgEditing(false) : setShowOrgPanel(false)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50">キャンセル</button>
                        <button onClick={handleSaveOrg} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">{editOrg ? '更新' : '登録'}</button>
                      </>
                    )}
                    <button onClick={() => setShowOrgPanel(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={18} className="text-gray-400" /></button>
                  </div>
                </div>

                {/* === 閲覧モード === */}
                {editOrg && !orgEditing ? (
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div><span className="text-xs text-gray-400">登録No.</span><div className="text-gray-800">{orgForm.registration_no || '—'}</div></div>
                      <div><span className="text-xs text-gray-400">登録年月日</span><div className="text-gray-800">{orgForm.registration_date || '—'}</div></div>
                    </div>
                    <div><span className="text-xs text-gray-400">大カテゴリ</span><div className="text-gray-800">{orgForm.group_name || '未分類'}</div></div>
                    <div><span className="text-xs text-gray-400">フリガナ</span><div className="text-gray-800">{orgForm.furigana || '—'}</div></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><span className="text-xs text-gray-400">代表者名</span><div className="text-gray-800">{[orgForm.rep_last_name, orgForm.rep_first_name].filter(Boolean).join(' ') || '—'}</div></div>
                      <div><span className="text-xs text-gray-400">フリガナ</span><div className="text-gray-800">{[orgForm.rep_last_name_kana, orgForm.rep_first_name_kana].filter(Boolean).join(' ') || '—'}</div></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><span className="text-xs text-gray-400">班－戸番</span><div className="text-gray-800">{orgForm.han_ko || '—'}</div></div>
                      <div><span className="text-xs text-gray-400">電話番号</span><div className="text-gray-800">{orgForm.phone || '—'}</div></div>
                    </div>
                    <div><span className="text-xs text-gray-400">メールアドレス</span><div className="text-gray-800">{orgForm.contact_email || '—'}</div></div>
                    <div><span className="text-xs text-gray-400">利用区分</span><div className="text-gray-800">{categories.find(c => c.tier === orgForm.category)?.name || orgForm.category}</div></div>
                    <div><span className="text-xs text-gray-400">活動内容</span><div className="text-gray-800">{orgForm.activity_description || '—'}</div></div>
                    <div><span className="text-xs text-gray-400">メモ</span><div className="text-gray-800 whitespace-pre-wrap">{(orgForm as any).notes || '—'}</div></div>
                    <div><span className="text-xs text-gray-400">月謝</span><div className="text-gray-800">{orgForm.has_monthly_fee ? 'あり' : 'なし'}</div></div>
                    <div><span className="text-xs text-gray-400">紐づけキーワード</span><div className="flex flex-wrap gap-1 mt-1">{(orgForm as any).keywords?.length > 0 ? (orgForm as any).keywords.map((k: string) => <span key={k} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{k}</span>) : <span className="text-gray-400">—</span>}</div></div>
                    <div><span className="text-xs text-gray-400">パスコード</span><div className="text-gray-800 font-mono">{orgForm.passcode || '—'}</div></div>
                    {orgForm.default_equipment.length > 0 && (
                      <div><span className="text-xs text-gray-400">利用設備</span><div className="flex flex-wrap gap-1 mt-1">{orgForm.default_equipment.map(e => <span key={e} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">{e}</span>)}</div></div>
                    )}
                    <div className="pt-2">
                      <span className="text-xs text-gray-400">表示設定</span>
                      <div className="flex bg-gray-100 rounded-lg p-0.5 mt-1">
                        {([
                          { value: true, label: '常に表示' },
                          { value: null, label: '自動' },
                          { value: false, label: '非表示' },
                        ] as { value: boolean | null; label: string }[]).map(opt => {
                          const current = editOrg?.is_active;
                          const isSelected = current === opt.value;
                          return (
                            <button
                              key={opt.label}
                              onClick={async () => {
                                await supaFetch(`booking_organizations?id=eq.${editOrg!.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: opt.value }) });
                                setOrgs(prev => prev.map(o => o.id === editOrg!.id ? { ...o, is_active: opt.value as any } : o));
                                setEditOrg(prev => prev ? { ...prev, is_active: opt.value as any } : prev);
                              }}
                              className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${
                                isSelected ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* === 編集モード === */
                  <>
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">登録No.</label><input value={orgForm.registration_no} onChange={e => setOrgForm(f => ({ ...f, registration_no: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">登録年月日</label><input type="date" value={orgForm.registration_date} onChange={e => setOrgForm(f => ({ ...f, registration_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">大カテゴリ</label>
                        <select value={orgForm.group_name} onChange={e => {
                          const g = orgGroups.find(og => og.name === e.target.value);
                          setOrgForm(f => ({ ...f, group_name: e.target.value, category: g?.default_tier || f.category }));
                        }} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                          <option value="">未分類</option>
                          {orgGroups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                        </select>
                      </div>
                      <div><label className="block text-xs font-medium text-gray-500 mb-1">団体名 *</label><input value={orgForm.name} onChange={e => setOrgForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                      <div><label className="block text-xs font-medium text-gray-500 mb-1">フリガナ</label><input value={orgForm.furigana} onChange={e => setOrgForm(f => ({ ...f, furigana: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">代表者名</label>
                        <div className="grid grid-cols-2 gap-2">
                          <input value={orgForm.rep_last_name} onChange={e => setOrgForm(f => ({ ...f, rep_last_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="姓" />
                          <input value={orgForm.rep_first_name} onChange={e => setOrgForm(f => ({ ...f, rep_first_name: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="名" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">代表者名（フリガナ）</label>
                        <div className="grid grid-cols-2 gap-2">
                          <input value={orgForm.rep_last_name_kana} onChange={e => setOrgForm(f => ({ ...f, rep_last_name_kana: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="セイ" />
                          <input value={orgForm.rep_first_name_kana} onChange={e => setOrgForm(f => ({ ...f, rep_first_name_kana: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="メイ" />
                        </div>
                      </div>
                      <div><label className="block text-xs font-medium text-gray-500 mb-1">班－戸番</label><input value={orgForm.han_ko} onChange={e => setOrgForm(f => ({ ...f, han_ko: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="例: 3-12" /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">電話番号</label><input value={orgForm.phone} onChange={e => setOrgForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                        <div><label className="block text-xs font-medium text-gray-500 mb-1">メールアドレス</label><input type="email" value={orgForm.contact_email} onChange={e => setOrgForm(f => ({ ...f, contact_email: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" /></div>
                      </div>
                      <div><label className="block text-xs font-medium text-gray-500 mb-1">利用区分</label><select value={orgForm.category} onChange={e => handleCategoryChange(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">{categories.map(c => <option key={c.tier} value={c.tier}>{c.name}</option>)}</select></div>
                      <div><label className="block text-xs font-medium text-gray-500 mb-1">活動内容</label><textarea value={orgForm.activity_description} onChange={e => setOrgForm(f => ({ ...f, activity_description: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" rows={2} /></div>
                      <div className="flex items-center gap-2"><input type="checkbox" id="monthly_fee" checked={orgForm.has_monthly_fee} onChange={e => {
                        const checked = e.target.checked;
                        setOrgForm(f => ({ ...f, has_monthly_fee: checked, category: checked ? '3' : (orgGroups.find(g => g.name === f.group_name)?.default_tier || f.category) }));
                      }} className="rounded" /><label htmlFor="monthly_fee" className="text-xs text-gray-600">月謝あり</label></div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">メモ</label>
                        <textarea
                          value={orgForm.notes}
                          onChange={e => setOrgForm(f => ({ ...f, notes: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          rows={2}
                          placeholder="親団体、備考など自由記入"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">紐づけキーワード（カンマ区切り）</label>
                        <input
                          value={orgForm.keywords.join(', ')}
                          onChange={e => setOrgForm(f => ({ ...f, keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="例: カラオケ, からおけ"
                        />
                        <p className="text-xs text-gray-400 mt-0.5">インポート時にタイトルとマッチして自動紐づけされます</p>
                      </div>
                      <div><label className="block text-xs font-medium text-gray-500 mb-1">パスコード</label><input value={orgForm.passcode} onChange={e => setOrgForm(f => ({ ...f, passcode: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono" placeholder="4桁の数字など" /></div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">主に利用予定の設備（予約ごとに変更できます）</label>
                        <div className="flex flex-wrap gap-2">
                          {equipmentList.map(eq => {
                            const checked = orgForm.default_equipment.includes(eq.name);
                            return (
                              <label key={eq.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer border transition-colors ${checked ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                                <input type="checkbox" checked={checked} onChange={() => {
                                  setOrgForm(f => ({ ...f, default_equipment: checked ? f.default_equipment.filter(e => e !== eq.name) : [...f.default_equipment, eq.name] }));
                                }} className="sr-only" />
                                {eq.name}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* === 設定 === */}
        {tab === 'settings' && (
          <SettingsTab categories={categories} onCategoriesChange={setCategories} />
        )}
      </main>

      {/* ポップオーバー: 作成 or 詳細 */}
      {popover?.type === 'create' && popover.date && (
        calendarSubView === 'schedule' ? (
          <EventCreatePopover
            date={popover.date}
            anchorRect={popover.anchorRect}
            onClose={closePopover}
            onSaved={() => { closePopover(); handleDayPanelRefresh(); }}
            isClosure={closures.has(`${popover.date.getFullYear()}-${String(popover.date.getMonth() + 1).padStart(2, '0')}-${String(popover.date.getDate()).padStart(2, '0')}`)}
            onClosureChange={() => {
              supaFetch('calendar_events?is_closure=eq.true&select=date')
                .then(r => r.json())
                .then((data: { date: string }[]) => setClosures(new Set(data.map(d => d.date))));
            }}
          />
        ) : (
          <BookingCreatePopover
            date={popover.date}
            anchorRect={popover.anchorRect}
            onClose={closePopover}
            onSaved={() => { closePopover(); handleDayPanelRefresh(); }}
          />
        )
      )}
      {popover?.type === 'detail' && popover.data && (
        <DetailPopover
          anchorRect={popover.anchorRect}
          data={popover.data}
          onClose={closePopover}
          onEdit={(data) => {
            closePopover();
            const d = new Date(data.date + 'T00:00:00');
            setSelectedDate(d);
            if (data.type === 'event') {
              setInitialEditId(data.id);
            } else {
              setInitialEditBookingId(data.id);
            }
            setShowDayPanel(true);
          }}
          onRefresh={handleDayPanelRefresh}
          onSwitchToFacility={async (eventId, eventDate) => {
            // event_idからbookingを特定
            const res = await supaFetch(`bookings?event_id=eq.${eventId}&status=in.(CONFIRMED,PENDING)&select=id&limit=1`);
            const bookings = res.ok ? await res.json() : [];
            setCalendarSubView('facility');
            if (bookings.length > 0) {
              const d = new Date(eventDate + 'T00:00:00');
              setSelectedDate(d);
              setInitialEditBookingId(bookings[0].id);
              setShowDayPanel(true);
            }
          }}
        />
      )}

      {/* +Nクリック時の一覧ポップオーバー */}
      {popover?.type === 'list' && popover.date && (() => {
        const dateStr = `${popover.date.getFullYear()}-${String(popover.date.getMonth() + 1).padStart(2, '0')}-${String(popover.date.getDate()).padStart(2, '0')}`;
        const dayBookings = bookings.filter(b => b.date === dateStr);
        const dow = ['日', '月', '火', '水', '木', '金', '土'][popover.date.getDay()];
        const ROOM_COLORS: Record<string, string> = { '会議室': 'bg-yellow-400', '和室（畳側）': 'bg-sky-400', '和室（椅子側）': 'bg-sky-400', '図書室': 'bg-pink-400' };
        return (
          <Popover anchorRect={popover.anchorRect} onClose={closePopover} width={300}>
            <div className="px-4 pt-3 pb-1 flex items-center justify-between">
              <span className="text-base font-bold text-gray-800">{popover.date.getMonth() + 1}月{popover.date.getDate()}日({dow})</span>
              <button onClick={closePopover} className="p-1 hover:bg-gray-100 rounded-full"><X size={16} className="text-gray-400" /></button>
            </div>
            <div className="px-4 pb-3 divide-y divide-gray-100">
              {dayBookings.map((b, i) => (
                <div key={i} onClick={() => { closePopover(); handleBookingItemClick(b, popover.anchorRect as unknown as DOMRect); }}
                  className="py-2 flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded -mx-1 px-1">
                  <span className={`${ROOM_COLORS[b.room] || 'bg-gray-400'} w-2 h-2 rounded-full shrink-0`} />
                  <span className="text-sm text-gray-900 truncate flex-1">{b.title}</span>
                  <span className="text-xs text-gray-400">{shortRoomName(b.room)}</span>
                </div>
              ))}
            </div>
          </Popover>
        );
      })()}

      {/* 日付パネル（予約一覧+追加+削除） */}
      {showDayPanel && selectedDate && (
        <AdminDayPanel
          date={selectedDate}
          bookings={bookings}
          isClosure={closures.has(`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`)}
          onClose={() => { setShowDayPanel(false); setInitialEditId(null); setInitialEditBookingId(null); }}
          onRefresh={handleDayPanelRefresh}
          mode={calendarSubView}
          initialEditId={initialEditId}
          initialEditBookingId={initialEditBookingId}
          onClosureChange={() => {
            supaFetch('calendar_events?is_closure=eq.true&select=date')
              .then(r => r.json())
              .then((data: { date: string }[]) => setClosures(new Set(data.map(d => d.date))));
          }}
        />
      )}
    </div>
  );
}
