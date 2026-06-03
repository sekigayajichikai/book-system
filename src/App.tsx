import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, ClipboardList, Info, Users, User, X, LogOut, List } from 'lucide-react';
import BookingCalendar from './components/BookingCalendar';
import DailyScheduleGrid from './components/DailyScheduleGrid';
import WeeklyView from './components/WeeklyView';
import BookingForm from './components/BookingForm';
import RoomMonthView from './components/RoomMonthView';
import RoomMonthWeekly from './components/RoomMonthWeekly';
import BookingDetailModal from './components/BookingDetailModal';
import MobileCalendarView from './components/mobile/MobileCalendarView';
import MobileBookingView from './components/mobile/MobileBookingView';
import CalendarView from './components/CalendarView';
import OrgFilterSidebar from './components/OrgFilterSidebar';
import MobileEventList from './components/mobile/MobileEventList';
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './components/admin/AdminDashboard';
import OrgLogin from './components/OrgLogin';
import MyPage from './components/MyPage';
import { useIsMobile } from './hooks/useIsMobile';
import { Booking, BookingStatus, RoomType, BookingRequest, CalendarEvent, OrgEntry } from './types';
import { ROOMS, TIME_SLOTS } from './constants';

/** 日付文字列を YYYY-MM-DD で返す */
function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 管理画面ラッパー（Hooksルール違反を防ぐため分離） */
function AdminApp() {
  const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem('admin_token'));

  if (!adminToken) {
    return <AdminLogin onLogin={(token) => setAdminToken(token)} />;
  }
  return <AdminDashboard onLogout={() => { localStorage.removeItem('admin_token'); setAdminToken(null); }} />;
}

function App() {
  // 管理画面ルーティング（#admin）
  const isAdminRoute = window.location.hash === '#admin';
  if (isAdminRoute) return <AdminApp />;

  const isMobile = useIsMobile();

  // 団体フィルタ
  const [filterOrgs, setFilterOrgs] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('filter_orgs');
    return saved ? new Set(JSON.parse(saved)) : new Set<string>();
  });
  const [filterInitialized, setFilterInitialized] = useState(false);
  const [showMajor, setShowMajor] = useState(true);

  // フィルタ初期化: 全団体をデフォルトON
  useEffect(() => {
    if (filterInitialized || isMobile) return;
    const sbUrl = import.meta.env.VITE_SUPABASE_URL;
    const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!sbUrl || !sbKey) return;
    const saved = localStorage.getItem('filter_orgs');
    if (saved) { setFilterInitialized(true); return; }
    fetch(`${sbUrl}/rest/v1/booking_organizations?select=name&is_active=not.is.false`, {
      headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` },
    }).then(r => r.json()).then(d => {
      const all = new Set<string>((d || []).map((o: any) => o.name));
      setFilterOrgs(all);
      localStorage.setItem('filter_orgs', JSON.stringify([...all]));
      setFilterInitialized(true);
    }).catch(() => setFilterInitialized(true));
  }, [isMobile, filterInitialized]);

  const handleToggleOrg = (name: string) => {
    setFilterOrgs(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      localStorage.setItem('filter_orgs', JSON.stringify([...next]));
      return next;
    });
  };
  const handleToggleGroup = (groupName: string, orgNames: string[]) => {
    setFilterOrgs(prev => {
      const next = new Set(prev);
      const allOn = orgNames.every(n => next.has(n));
      orgNames.forEach(n => allOn ? next.delete(n) : next.add(n));
      localStorage.setItem('filter_orgs', JSON.stringify([...next]));
      return next;
    });
  };
  const handleSelectAll = () => {
    const sbUrl = import.meta.env.VITE_SUPABASE_URL;
    const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!sbUrl || !sbKey) return;
    fetch(`${sbUrl}/rest/v1/booking_organizations?select=name&is_active=not.is.false`, {
      headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` },
    }).then(r => r.json()).then(d => {
      const all = new Set<string>((d || []).map((o: any) => o.name));
      setFilterOrgs(all);
      localStorage.setItem('filter_orgs', JSON.stringify([...all]));
    }).catch(() => {});
  };
  const handleDeselectAll = () => {
    setFilterOrgs(new Set());
    localStorage.setItem('filter_orgs', JSON.stringify([]));
  };
  const handleSelectOnly = (name: string) => {
    const next = new Set<string>([name]);
    setFilterOrgs(next);
    localStorage.setItem('filter_orgs', JSON.stringify([...next]));
  };

  // 団体ログイン状態
  const [orgId, setOrgId] = useState<string | null>(() => localStorage.getItem('org_id'));
  const [orgName, setOrgName] = useState<string | null>(() => localStorage.getItem('org_name'));
  const [showOrgLogin, setShowOrgLogin] = useState(false);
  const [showMyPage, setShowMyPage] = useState(false);
  const isOrgLoggedIn = !!orgId;

  const handleOrgLogin = (id: string, name: string) => {
    setOrgId(id);
    setOrgName(name);
    setShowOrgLogin(false);
  };

  const handleOrgLogout = () => {
    setOrgId(null);
    setOrgName(null);
    setShowMyPage(false);
    localStorage.removeItem('org_token');
    localStorage.removeItem('org_id');
    localStorage.removeItem('org_name');
  };

  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [showDailyGrid, setShowDailyGrid] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ room: RoomType; start: string; end: string } | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);

  const [calendarMode, setCalendarModeState] = useState<'schedule' | 'calendar' | 'booking'>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'calendar' || hash === 'monthly') return 'calendar';
    if (hash === 'weekly' || hash === 'room') return 'booking';
    return 'schedule';
  });
  const [bookingSubView, setBookingSubViewState] = useState<'weekly' | 'monthly'>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'weekly') return 'weekly';
    return 'monthly';
  });
  const [roomFilter, setRoomFilterState] = useState<boolean>(() => {
    const hash = window.location.hash.replace('#', '');
    return hash === 'room';
  });

  const updateHash = (mode: 'schedule' | 'calendar' | 'booking', sub: 'weekly' | 'monthly', rf: boolean) => {
    if (mode === 'schedule') { window.location.hash = 'schedule'; return; }
    if (mode === 'calendar') { window.location.hash = 'calendar'; return; }
    if (rf) { window.location.hash = 'room'; return; }
    window.location.hash = sub;
  };
  const setCalendarMode = (mode: 'schedule' | 'calendar' | 'booking') => {
    setCalendarModeState(mode);
    if (mode === 'booking') {
      setBookingSubViewState('monthly');
      setRoomFilterState(false);
      setSelectedRoom(null);
      updateHash(mode, 'monthly', false);
    } else {
      updateHash(mode, bookingSubView, roomFilter);
    }
  };
  const setBookingSubView = (sub: 'weekly' | 'monthly') => {
    setBookingSubViewState(sub);
    updateHash('booking', sub, roomFilter);
  };
  const setRoomFilter = (rf: boolean) => {
    setRoomFilterState(rf);
    if (rf && !selectedRoom) setSelectedRoom(ROOMS[0]);
    updateHash('booking', bookingSubView, rf);
  };

  const [selectedRoom, setSelectedRoom] = useState<typeof ROOMS[0] | null>(() => {
    const hash = window.location.hash.replace('#', '');
    return hash === 'room' ? ROOMS[0] : null;
  });
  const [roomMonth, setRoomMonth] = useState(new Date());
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1)); // 今週の月曜
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [orgsByCategory, setOrgsByCategory] = useState<Record<string, OrgEntry[]>>({});
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [closures, setClosures] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  /** 団体マスタ + 祝日を取得 */
  useEffect(() => {
    fetch('/api/masters')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.orgs) setOrgsByCategory(data.orgs);
      })
      .catch(err => console.error('マスタ取得エラー:', err));

    fetch(`/api/holidays?year=${new Date().getFullYear()}`)
      .then(res => res.ok ? res.json() : [])
      .then((data: { date: string; name: string }[]) => {
        const map: Record<string, string> = {};
        data.forEach(h => { map[h.date] = h.name; });
        setHolidays(map);
      })
      .catch(err => console.error('祝日取得エラー:', err));

    const sbUrl = import.meta.env.VITE_SUPABASE_URL;
    const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (sbUrl && sbKey) {
      fetch(`${sbUrl}/rest/v1/calendar_events?is_closure=eq.true&select=date`, {
        headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` },
      })
        .then(r => r.json())
        .then((data: { date: string }[]) => setClosures(new Set(data.map(d => d.date))))
        .catch(() => {});

      // 最終更新日を取得
      fetch(`${sbUrl}/rest/v1/import_batches?select=source_updated_at&status=eq.applied&source_updated_at=not.is.null&order=source_updated_at.desc&limit=1`, {
        headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` },
      })
        .then(r => r.json())
        .then((data: any[]) => {
          if (data?.[0]?.source_updated_at) setLastUpdated(data[0].source_updated_at);
        })
        .catch(() => {});
    }
  }, []);

  /** スプレッドシートからイベントを取得（GAS API経由） */
  const fetchEvents = useCallback(async (year: number, month: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings-view?year=${year}&month=${month + 1}`);
      if (!res.ok) throw new Error('API error');
      const events: CalendarEvent[] = await res.json();
      setBookings(events.map(evt => ({
        id: evt.id,
        date: evt.date,
        startTime: evt.startTime,
        endTime: evt.endTime,
        room: evt.room ?? RoomType.KAIGISHITSU,
        title: evt.summary,
        status: BookingStatus.CONFIRMED,
      })));
    } catch (err) {
      console.error('カレンダーの取得に失敗しました', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(currentDate.getFullYear(), currentDate.getMonth());
  }, [currentDate, fetchEvents]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowDailyGrid(true);
  };

  /** カレンダーの日付タップ → 予約ビューの週間表示にジャンプ */
  const handleDateTapToBooking = (date: Date) => {
    const d = new Date(date);
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1)); // その週の月曜
    d.setHours(0, 0, 0, 0);
    setWeekStart(d);
    setCalendarModeState('booking');
    setBookingSubViewState('weekly');
    setRoomFilterState(false);
    window.location.hash = 'weekly';
  };

  const handleSlotClick = (room: RoomType, _slotId: string, startTime: string, endTime: string) => {
    setSelectedSlot({ room, start: startTime, end: endTime });
    setShowDailyGrid(false);
    setShowBookingForm(true);
  };

  const handleWeeklySlotClick = (date: Date, room: RoomType, _slotId: string, startTime: string, endTime: string) => {
    setSelectedDate(date);
    setSelectedSlot({ room, start: startTime, end: endTime });
    setShowBookingForm(true);
  };

  const handlePrevWeek = () => {
    setWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const handleNextWeek = () => {
    setWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const handleBookingSubmit = async (data: BookingRequest) => {
    const isPending = isOrgLoggedIn;
    const status = isPending ? BookingStatus.PENDING : BookingStatus.CONFIRMED;

    const newBooking: Booking = {
      id: 'temp_' + Date.now(),
      date: data.date,
      startTime: TIME_SLOTS.find(s => s.gasKey === data.slot)?.startTime || '09:00',
      endTime: TIME_SLOTS.find(s => s.gasKey === data.slot)?.endTime || '12:00',
      room: (data.room as RoomType) || RoomType.KAIGISHITSU,
      title: data.title,
      status,
    };
    setBookings(prev => [...prev, newBooking]);
    setShowBookingForm(false);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 5000);

    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, status, org_id: orgId || undefined }),
      });
      if (!res.ok) throw new Error('保存エラー');
    } catch (err) {
      console.error('保存エラー:', err);
      // 失敗したら楽観的更新を巻き戻す
      setBookings(prev => prev.filter(b => b.id !== newBooking.id));
      alert('保存に失敗しました。もう一度お試しください。');
    }
  };

  // モード切替トグル（PC用: CalendarView/BookingCalendarヘッダーに埋め込む）
  const modeToggleEl = !isMobile ? (
    <div className="flex items-center bg-gray-100 rounded-full p-0.5 shrink-0">
      <button onClick={() => { setCalendarMode('schedule'); setShowMyPage(false); }}
        className={`px-4 py-1.5 rounded-full text-base font-bold transition-all ${
          !showMyPage && calendarMode === 'schedule' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}>カレンダー</button>
      <button onClick={() => { setCalendarMode('calendar'); setShowMyPage(false); }}
        className={`px-4 py-1.5 rounded-full text-base font-bold transition-all ${
          !showMyPage && calendarMode === 'calendar' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
        }`}>会館予約</button>
    </div>
  ) : undefined;

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans text-gray-800 overflow-hidden">
      {/* Header: モバイル or ログイン時のみ表示 */}
      {(isMobile || isOrgLoggedIn) && (
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className={`max-w-5xl mx-auto px-4 ${isMobile ? 'h-12' : 'h-14'} flex items-center justify-between`}>
          {/* ビュー切替ボタン */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setCalendarMode('schedule'); setShowMyPage(false); }}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all active:scale-95 ${
                !showMyPage && calendarMode === 'schedule'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <List size={16} className="inline-block mr-1 -mt-0.5" />カレンダー
            </button>
            <button
              onClick={() => { setCalendarMode('calendar'); setShowMyPage(false); }}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all active:scale-95 ${
                !showMyPage && calendarMode === 'calendar'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <CalendarDays size={16} className="inline-block mr-1 -mt-0.5" />会館予約
            </button>
            {isOrgLoggedIn && (
              <button
                onClick={() => { setCalendarMode('booking'); setShowMyPage(false); }}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  !showMyPage && calendarMode === 'booking'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <ClipboardList size={16} className="inline-block mr-1 -mt-0.5" />予約
              </button>
            )}
            {isOrgLoggedIn && (
              <button
                onClick={() => { setShowMyPage(true); setCalendarModeState('booking'); }}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  showMyPage ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <User size={16} className="inline-block mr-1 -mt-0.5" />マイページ
              </button>
            )}
          </div>
          {/* 右: アカウント */}
          <div className="flex items-center gap-2">
            {isOrgLoggedIn ? (
              <>
                {!isMobile && <span className="text-xs text-gray-500">{orgName}</span>}
                <button onClick={handleOrgLogout} className="p-1.5 hover:bg-gray-100 rounded-full" title="ログアウト">
                  <LogOut size={18} className="text-gray-400" />
                </button>
              </>
            ) : (
              null
            )}
          </div>
        </div>
      </header>
      )}

      {/* Main Content */}
      <main className="flex-1 w-full px-4 py-3 flex flex-col min-h-0">
        {showSuccessMessage && (
          <div className="mb-6 p-4 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl flex items-start gap-3 shadow-sm relative">
            <div className="bg-white p-1 rounded-full mt-0.5"><Info size={20} className="text-emerald-500" /></div>
            <div className="flex-1">
              <p className="font-bold">保存しました</p>
              <p className="text-sm">スプレッドシートの確定シートに登録されました。</p>
            </div>
            <button onClick={() => setShowSuccessMessage(false)} className="text-emerald-400 hover:text-emerald-600"><X size={18} /></button>
          </div>
        )}

        <div className="space-y-6 flex-1 flex flex-col min-h-0">
            {/* 予約モード: 部屋フィルタ + 月/週トグル + 部屋別（1行） */}
            {calendarMode === 'booking' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-gray-400">部屋:</span>
                <button
                  onClick={() => { setSelectedRoom(null); setRoomFilter(false); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedRoom === null
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  全部屋
                </button>
                {ROOMS.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRoom(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedRoom?.id === r.id
                        ? 'bg-gray-700 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {r.shortName}
                  </button>
                ))}
                {/* 右寄せ: 部屋別 + 月/週トグル */}
                <div className="flex items-center gap-2 ml-auto">
                  <div className="flex items-center bg-gray-100 rounded-full p-0.5">
                    <button
                      onClick={() => setBookingSubView('monthly')}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                        bookingSubView === 'monthly' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      月
                    </button>
                    <button
                      onClick={() => setBookingSubView('weekly')}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                        bookingSubView === 'weekly' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      週
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* マイページ */}
            {showMyPage && isOrgLoggedIn ? (
              <MyPage orgId={orgId!} orgName={orgName!} />
            ) :

            /* 予定タブ（イベント一覧） */
            calendarMode === 'schedule' ? (
              isMobile ? (
                <MobileEventList holidays={holidays} closures={closures} />
              ) : (
                <div className="flex gap-4">
                  <OrgFilterSidebar selectedOrgs={filterOrgs} onToggleOrg={handleToggleOrg} onToggleGroup={handleToggleGroup} onSelectAll={handleSelectAll} onDeselectAll={handleDeselectAll} onSelectOnly={handleSelectOnly} showMajor={showMajor} onToggleMajor={() => setShowMajor(v => !v)} />
                  <div className="flex-1 min-w-0">
                    <CalendarView holidays={holidays} closures={closures} modeToggle={modeToggleEl} filterOrgs={filterOrgs} showMajor={showMajor} />
                  </div>
                </div>
              )
            ) :

            /* ビュー表示 */
            isMobile ? (
              /* === モバイル版 === */
              calendarMode === 'calendar' ? (
                <>
                                <MobileCalendarView
                  weekStart={weekStart}
                  bookings={bookings}
                  onPrevWeek={handlePrevWeek}
                  onNextWeek={handleNextWeek}
                  holidays={holidays}
                  closures={closures}
                  loading={loading}
                />
                </>
              ) : (
                <MobileBookingView
                  weekStart={weekStart}
                  bookings={bookings}
                  onPrevWeek={handlePrevWeek}
                  onNextWeek={handleNextWeek}
                  filterRoom={selectedRoom?.id || null}
                  holidays={holidays}
                  readOnly
                />
              )
            ) : (
              /* === PC版（既存） === */
              calendarMode === 'calendar' ? (
                <div className="flex gap-4 flex-1 min-h-0">
                  <OrgFilterSidebar selectedOrgs={filterOrgs} onToggleOrg={handleToggleOrg} onToggleGroup={handleToggleGroup} onSelectAll={handleSelectAll} onDeselectAll={handleDeselectAll} onSelectOnly={handleSelectOnly} showMajor={showMajor} onToggleMajor={() => setShowMajor(v => !v)} />
                  <BookingCalendar
                    currentDate={currentDate}
                    onPrevMonth={handlePrevMonth}
                    onNextMonth={handleNextMonth}
                    bookings={bookings}
                    onDateClick={handleDateClick}
                    holidays={holidays}
                    closures={closures}
                    loading={loading}
                    modeToggle={modeToggleEl}
                    subTitle={lastUpdated ? `更新日: ${new Date(lastUpdated + 'T00:00:00').toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}` : undefined}
                  />
                </div>
              ) : bookingSubView === 'weekly' ? (
                <WeeklyView
                  weekStart={weekStart}
                  bookings={bookings}
                  onPrevWeek={handlePrevWeek}
                  onNextWeek={handleNextWeek}
                  onSlotClick={handleWeeklySlotClick}
                  onBookingClick={setDetailBooking}
                  filterRoom={roomFilter ? (selectedRoom?.id || null) : (selectedRoom?.id || null)}
                  holidays={holidays}
                />
              ) : !roomFilter ? (
                <RoomMonthWeekly
                  bookings={bookings}
                  year={roomMonth.getFullYear()}
                  month={roomMonth.getMonth()}
                  onPrevMonth={() => setRoomMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  onNextMonth={() => setRoomMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  onSlotClick={handleWeeklySlotClick}
                  onBookingClick={setDetailBooking}
                  filterRoom={selectedRoom?.id || null}
                  holidays={holidays}
                />
              ) : selectedRoom ? (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                  <RoomMonthView
                    room={selectedRoom}
                    bookings={bookings.filter(b => b.room === selectedRoom.id)}
                    year={roomMonth.getFullYear()}
                    month={roomMonth.getMonth()}
                    onPrevMonth={() => setRoomMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                    onNextMonth={() => setRoomMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                    onBookingClick={() => {}}
                    onSlotClick={(date, slot) => {
                      setSelectedDate(date);
                      setSelectedSlot({ room: selectedRoom.id, start: slot.startTime, end: slot.endTime });
                      setShowBookingForm(true);
                    }}
                  />
                </div>
              ) : null
            )}
          </div>
      </main>


      {/* Modals */}
      {showDailyGrid && selectedDate && (
        <DailyScheduleGrid
          date={selectedDate}
          bookings={bookings.filter(b => b.date === formatDate(selectedDate))}
          onClose={() => setShowDailyGrid(false)}
          onSelectSlot={handleSlotClick}
        />
      )}

      {showBookingForm && selectedDate && selectedSlot && (
        <BookingForm
          selectedDate={selectedDate}
          initialRoom={selectedSlot.room}
          initialStartTime={selectedSlot.start}
          initialEndTime={selectedSlot.end}
          onCancel={() => setShowBookingForm(false)}
          onSubmit={handleBookingSubmit}
          orgsByCategory={orgsByCategory}
          submitting={submitting}
        />
      )}

      {detailBooking && (
        <BookingDetailModal
          booking={detailBooking}
          onClose={() => setDetailBooking(null)}
        />
      )}

      {/* 団体ログインモーダル */}
      {showOrgLogin && (
        <OrgLogin onLogin={handleOrgLogin} onClose={() => setShowOrgLogin(false)} />
      )}
    </div>
  );
}

export default App;
