import { useState, useEffect, useCallback } from 'react';
import { Menu, MapPin, Phone, Calendar as CalendarIcon, Info, Users, X } from 'lucide-react';
import Calendar from './components/Calendar';
import DailyScheduleGrid from './components/DailyScheduleGrid';
import BookingForm from './components/BookingForm';
import { Booking, BookingStatus, RoomType, BookingRequest, CalendarEvent } from './types';
import { TIME_SLOTS } from './constants';

/** 日付文字列を YYYY-MM-DD で返す */
function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [showDailyGrid, setShowDailyGrid] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ room: RoomType; start: string; end: string } | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [currentView, setCurrentView] = useState('home');

  /** Googleカレンダーからイベントを取得 */
  const fetchEvents = useCallback(async (year: number, month: number) => {
    setLoading(true);
    try {
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month + 2 > 12 ? 1 : month + 2).padStart(2, '0')}-01`;
      const res = await fetch(`/api/calendar?start=${startDate}&end=${endDate}`);
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
    } catch {
      console.error('カレンダーの取得に失敗しました');
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

  const handleSlotClick = (room: RoomType, _slotId: string, startTime: string, endTime: string) => {
    setSelectedSlot({ room, start: startTime, end: endTime });
    setShowDailyGrid(false);
    setShowBookingForm(true);
  };

  const handleBookingSubmit = async (data: BookingRequest) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('送信エラー');
      setShowBookingForm(false);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 8000);
    } catch {
      alert('送信に失敗しました。お手数ですが事務局へ直接お電話ください。');
    } finally {
      setSubmitting(false);
    }
  };

  const NavItem = ({ view, label, icon: Icon }: { view: string; label: string; icon: React.FC<{ size?: number }> }) => (
    <button
      onClick={() => setCurrentView(view)}
      className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
        currentView === view
          ? 'bg-emerald-600 text-white shadow-md'
          : 'text-gray-600 hover:bg-emerald-50'
      }`}
    >
      <Icon size={18} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-gray-800">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('home')}>
            <div className="bg-emerald-600 p-1.5 rounded-lg">
              <Users className="text-white" size={24} />
            </div>
            <h1 className="text-lg md:text-xl font-bold text-gray-800 tracking-tight">
              関ヶ谷自治会館<span className="text-emerald-600">予約</span>
            </h1>
          </div>
          <nav className="hidden md:flex gap-2">
            <NavItem view="home" label="ホーム" icon={Menu} />
            <NavItem view="calendar" label="空き状況・予約" icon={CalendarIcon} />
            <NavItem view="access" label="アクセス" icon={MapPin} />
          </nav>
          {/* Mobile nav */}
          <div className="flex md:hidden gap-1">
            <button onClick={() => setCurrentView('calendar')} className={`p-2 rounded-lg ${currentView === 'calendar' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500'}`}>
              <CalendarIcon size={22} />
            </button>
            <button onClick={() => setCurrentView('access')} className={`p-2 rounded-lg ${currentView === 'access' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500'}`}>
              <MapPin size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">
        {showSuccessMessage && (
          <div className="mb-6 p-4 bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl flex items-start gap-3 shadow-sm relative">
            <div className="bg-white p-1 rounded-full mt-0.5"><Info size={20} className="text-emerald-500" /></div>
            <div className="flex-1">
              <p className="font-bold">予約リクエストを送信しました！</p>
              <p className="text-sm">事務局へLINEで通知済みです。確認後に折り返しご連絡いたします。</p>
            </div>
            <button onClick={() => setShowSuccessMessage(false)} className="text-emerald-400 hover:text-emerald-600"><X size={18} /></button>
          </div>
        )}

        {currentView === 'home' && (
          <div className="space-y-8">
            <div className="relative rounded-3xl overflow-hidden shadow-xl h-64 md:h-80 bg-emerald-800">
              <div className="absolute inset-0 flex flex-col justify-center items-center text-center text-white p-6">
                <h2 className="text-3xl md:text-5xl font-bold mb-4">関ヶ谷自治会館</h2>
                <p className="text-lg md:text-xl mb-8 text-emerald-100 max-w-xl">
                  会議、サークル活動、レクリエーションなど。<br />
                  どなたでも気軽にご利用いただけます。
                </p>
                <button
                  onClick={() => setCurrentView('calendar')}
                  className="bg-white text-emerald-700 hover:bg-emerald-50 font-bold py-3 px-8 rounded-full shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 text-lg"
                >
                  <CalendarIcon />
                  空き状況を確認
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users size={24} />
                </div>
                <h3 className="font-bold text-lg mb-2">誰でも利用可能</h3>
                <p className="text-gray-600 text-sm">自治会員の方はもちろん、地域の方どなたでも。</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CalendarIcon size={24} />
                </div>
                <h3 className="font-bold text-lg mb-2">Webで空き確認</h3>
                <p className="text-gray-600 text-sm">24時間いつでも空き状況を確認し、予約リクエストを送れます。</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone size={24} />
                </div>
                <h3 className="font-bold text-lg mb-2">事務局サポート</h3>
                <p className="text-gray-600 text-sm">ご不明点は事務局までお気軽にお問い合わせください。</p>
              </div>
            </div>
          </div>
        )}

        {currentView === 'calendar' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                  <CalendarIcon size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">予約状況カレンダー</h2>
                  <p className="text-gray-500 text-sm">日付をクリックすると時間割が表示されます。</p>
                </div>
              </div>

              <Calendar
                currentDate={currentDate}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
                bookings={bookings}
                onDateClick={handleDateClick}
                loading={loading}
              />

              <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-white border border-gray-300 rounded-full" />空きあり</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-orange-100 border border-orange-300 rounded-full" />混雑</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 bg-red-100 border border-red-300 rounded-full" />満室</div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'access' && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <MapPin className="text-emerald-600" />
                アクセス・お問い合わせ
              </h2>
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="font-bold text-lg mb-2 text-gray-700">所在地</h3>
                    <p className="text-gray-600 leading-relaxed">
                      〒236-0042<br />
                      横浜市金沢区釜利谷東4-41-10<br />
                      関ヶ谷自治会館
                    </p>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2 text-gray-700">連絡先</h3>
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <Phone size={18} />
                      <span>事務局へお問い合わせください</span>
                    </div>
                    <p className="text-sm text-gray-500">
                      ※予約の追加・変更・キャンセルは<br />
                      このサイトまたは事務局へ直接ご連絡ください。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 text-slate-400 py-8 text-center text-sm">
        <div className="max-w-5xl mx-auto px-4">
          <p className="mb-2">&copy; {new Date().getFullYear()} 関ヶ谷自治会</p>
          <p>このサイトは住民の利便性向上のために運営されています。</p>
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
          submitting={submitting}
        />
      )}
    </div>
  );
}

export default App;
