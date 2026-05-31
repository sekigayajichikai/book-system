import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Clock, Home } from 'lucide-react';
import { EventSummary } from '../../types';
import { shortRoomName } from '../../constants';
import { useSwipe } from '../../hooks/useSwipe';


const DOW = ['日', '月', '火', '水', '木', '金', '土'];

interface MobileEventListProps {
  holidays: Record<string, string>;
  closures: Set<string>;
}

export default function MobileEventList({ holidays, closures }: MobileEventListProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const todayRef = useRef<HTMLDivElement>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchEvents = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events?year=${y}&month=${m + 1}&visibility=public`);
      if (!res.ok) throw new Error('API error');
      const data: EventSummary[] = await res.json();
      setEvents(data);
    } catch (err) {
      console.error('イベント取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(year, month);
  }, [year, month, fetchEvents]);

  useEffect(() => {
    if (!loading && todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading]);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const containerRef = useRef<HTMLDivElement>(null);
  useSwipe(containerRef, {
    onSwipeLeft: handleNextMonth,
    onSwipeRight: handlePrevMonth,
  });

  // 日付でグループ化
  const grouped: Record<string, EventSummary[]> = {};
  events.forEach(e => {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  });
  const sortedDates = Object.keys(grouped).sort();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div ref={containerRef}>
      {/* ヘッダー: 月ナビゲーション */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={24} className="text-gray-500" />
        </button>
        <h2 className="text-lg font-bold text-gray-800">
          {year}年 {month + 1}月の予定
        </h2>
        <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronRight size={24} className="text-gray-500" />
        </button>
      </div>

      {/* イベント一覧 */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-12 text-center text-gray-400">読み込み中...</div>
        ) : sortedDates.length === 0 ? (
          <div className="py-12 text-center text-gray-400">この月の予定はありません</div>
        ) : (
          sortedDates.map(dateStr => {
            const d = new Date(dateStr + 'T00:00:00');
            const dow = d.getDay();
            const isToday = dateStr === todayStr;
            const isPast = dateStr < todayStr;
            const holidayName = holidays[dateStr];
            const isClosure = closures.has(dateStr);

            return (
              <div
                key={dateStr}
                ref={isToday ? todayRef : undefined}
                className={`rounded-xl border p-4 ${
                  isToday ? 'border-emerald-400 bg-emerald-50/50 ring-2 ring-emerald-200' :
                  isPast ? 'border-gray-200 bg-white opacity-60' :
                  'border-gray-200 bg-white'
                }`}
              >
                {/* 日付ヘッダー */}
                <div className="flex items-baseline gap-2 mb-2">
                  <span className={`text-2xl font-bold ${
                    isToday ? 'text-emerald-600' :
                    (holidayName || dow === 0) ? 'text-red-500' :
                    dow === 6 ? 'text-blue-500' : 'text-gray-800'
                  }`}>
                    {d.getMonth() + 1}/{d.getDate()}
                  </span>
                  <span className={`text-lg ${
                    isToday ? 'text-emerald-500' :
                    (holidayName || dow === 0) ? 'text-red-400' :
                    dow === 6 ? 'text-blue-400' : 'text-gray-400'
                  }`}>
                    ({DOW[dow]})
                  </span>
                  {isClosure && <span className="text-sm bg-orange-400 text-white px-2 py-0.5 rounded font-bold">休館</span>}
                  {holidayName && <span className="text-sm text-red-500 font-bold">{holidayName}</span>}
                  {isToday && <span className="text-sm bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">TODAY</span>}
                </div>

                {/* イベント */}
                <div className="space-y-2">
                  {grouped[dateStr].map(evt => (
                    <MobileEventCard key={evt.id} event={evt} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function MobileEventCard({ event }: { event: EventSummary }) {
  const timeStr = event.startTime && event.endTime
    ? `${event.startTime}〜${event.endTime}`
    : event.startTime
      ? `${event.startTime}〜`
      : null;

  const roomStr = event.rooms.length > 0
    ? event.rooms.map(r => shortRoomName(r)).join('・')
    : null;

  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2.5">
      <div className="font-bold text-base text-gray-800">{event.title}</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-sm text-gray-500">
        {timeStr && (
          <span className="flex items-center gap-1">
            <Clock size={14} /> {timeStr}
          </span>
        )}
        {event.eventType === 'facility' && roomStr && (
          <span className="flex items-center gap-1">
            <Home size={14} /> {roomStr}
          </span>
        )}
        {event.eventType === 'general' && event.location && (
          <span className="flex items-center gap-1">
            <MapPin size={14} /> {event.location}
          </span>
        )}
      </div>
      {event.memo && (
        <div className="mt-1 text-sm text-gray-400">{event.memo}</div>
      )}
    </div>
  );
}
