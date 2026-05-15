import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, ClipboardList, DoorOpen, Info, Users, X } from 'lucide-react';
import Calendar from './components/Calendar';
import DailyScheduleGrid from './components/DailyScheduleGrid';
import WeeklyView from './components/WeeklyView';
import BookingForm from './components/BookingForm';
import RoomMonthView from './components/RoomMonthView';
import RoomMonthWeekly from './components/RoomMonthWeekly';
import BookingDetailModal from './components/BookingDetailModal';
import MobileCalendarView from './components/mobile/MobileCalendarView';
import MobileBookingView from './components/mobile/MobileBookingView';
import { useIsMobile } from './hooks/useIsMobile';
import { Booking, BookingStatus, RoomType, BookingRequest, CalendarEvent, OrgEntry } from './types';
import { ROOMS, TIME_SLOTS } from './constants';

/** 日付文字列を YYYY-MM-DD で返す */
function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function App() {
  const isMobile = useIsMobile();
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

  const [calendarMode, setCalendarModeState] = useState<'calendar' | 'booking'>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'calendar' || hash === 'monthly') return 'calendar';
    return 'booking';
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

  const updateHash = (mode: 'calendar' | 'booking', sub: 'weekly' | 'monthly', rf: boolean) => {
    if (mode === 'calendar') { window.location.hash = 'calendar'; return; }
    if (rf) { window.location.hash = 'room'; return; }
    window.location.hash = sub;
  };
  const setCalendarMode = (mode: 'calendar' | 'booking') => {
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
  }, []);

  /** スプレッドシートからイベントを取得（GAS API経由） */
  const fetchEvents = useCallback(async (year: number, month: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar?year=${year}&month=${month + 1}`);
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
    // 30秒ポーリング
    const interval = setInterval(() => {
      fetchEvents(currentDate.getFullYear(), currentDate.getMonth());
    }, 30000);
    return () => clearInterval(interval);
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
    // 楽観的更新: 先に画面に反映
    const newBooking: Booking = {
      id: 'temp_' + Date.now(),
      date: data.date,
      startTime: TIME_SLOTS.find(s => s.gasKey === data.slot)?.startTime || '09:00',
      endTime: TIME_SLOTS.find(s => s.gasKey === data.slot)?.endTime || '12:00',
      room: (data.room as RoomType) || RoomType.KAIGISHITSU,
      title: data.title,
      status: BookingStatus.CONFIRMED,
    };
    setBookings(prev => [...prev, newBooking]);
    setShowBookingForm(false);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 5000);

    // 裏でAPI保存
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('保存エラー');
    } catch (err) {
      console.error('保存エラー:', err);
      // 失敗したら楽観的更新を巻き戻す
      setBookings(prev => prev.filter(b => b.id !== newBooking.id));
      alert('保存に失敗しました。もう一度お試しください。');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-800">
      {/* Header: タイトル右寄せ + ビュー切替ボタンを同一行に */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className={`max-w-5xl mx-auto px-4 ${isMobile ? 'h-12' : 'h-14'} flex items-center justify-between`}>
          {/* ビュー切替ボタン */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCalendarMode('calendar')}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all active:scale-95 ${
                calendarMode === 'calendar'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <CalendarDays size={16} className="inline-block mr-1 -mt-0.5" />カレンダー
            </button>
            <button
              onClick={() => setCalendarMode('booking')}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                calendarMode === 'booking'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ClipboardList size={16} className="inline-block mr-1 -mt-0.5" />予約
            </button>
          </div>
          {/* タイトル右寄せ（スマホではアイコンのみ） */}
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg">
              <Users className="text-white" size={isMobile ? 16 : 20} />
            </div>
            {!isMobile && (
              <h1 className="text-lg font-bold text-gray-800 tracking-tight">
                関ヶ谷自治会
              </h1>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">
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

        <div className="space-y-6">
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
                    {r.name.replace('（畳側）', '(畳)').replace('（椅子側）', '(椅子)')}
                  </button>
                ))}
                {/* 右寄せ: 部屋別 + 月/週トグル */}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => {
                      setRoomFilter(!roomFilter);
                      if (!roomFilter && !selectedRoom) setSelectedRoom(ROOMS[0]);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] transition-all ${
                      roomFilter
                        ? 'bg-emerald-600 text-white'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                    title="部屋を選択すると、その部屋だけの月間カレンダーを表示"
                  >
                    <DoorOpen size={12} className="inline-block -mt-0.5" /> 月間別ver
                  </button>
                  <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                    <button
                      onClick={() => setBookingSubView('monthly')}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                        bookingSubView === 'monthly' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      月
                    </button>
                    <button
                      onClick={() => setBookingSubView('weekly')}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                        bookingSubView === 'weekly' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      週
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ビュー表示 */}
            {isMobile ? (
              /* === モバイル版 === */
              calendarMode === 'calendar' ? (
                <MobileCalendarView
                  weekStart={weekStart}
                  bookings={bookings}
                  onPrevWeek={handlePrevWeek}
                  onNextWeek={handleNextWeek}
                  holidays={holidays}
                  loading={loading}
                />
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
                <Calendar
                  currentDate={currentDate}
                  onPrevMonth={handlePrevMonth}
                  onNextMonth={handleNextMonth}
                  bookings={bookings}
                  onDateClick={handleDateClick}
                  loading={loading}
                />
              ) : bookingSubView === 'weekly' ? (
                <WeeklyView
                  weekStart={weekStart}
                  bookings={bookings}
                  onPrevWeek={handlePrevWeek}
                  onNextWeek={handleNextWeek}
                  onSlotClick={handleWeeklySlotClick}
                  onBookingClick={setDetailBooking}
                  filterRoom={roomFilter ? (selectedRoom?.id || null) : (selectedRoom?.id || null)}
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

      {/* Footer */}
      <footer className={`bg-slate-800 text-slate-400 ${isMobile ? 'py-4 text-xs' : 'py-8 text-sm'} text-center`}>
        <div className="max-w-5xl mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} 関ヶ谷自治会</p>
        </div>
      </footer>

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
    </div>
  );
}

export default App;
