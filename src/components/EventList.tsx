import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Clock, Home } from 'lucide-react';
import { EventSummary } from '../types';
import { shortRoomName } from '../constants';

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

interface EventListProps {
  holidays: Record<string, string>;
  closures: Set<string>;
}

export default function EventList({ holidays, closures }: EventListProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(false);

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

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* ヘッダー: 月ナビゲーション */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <h2 className="text-xl font-bold text-gray-800">
          {year}年 {month + 1}月の予定
        </h2>
        <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronRight size={20} className="text-gray-500" />
        </button>
      </div>

      {/* イベント一覧 */}
      <div className="divide-y divide-gray-50">
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
                className={`flex gap-4 px-6 py-4 ${isToday ? 'bg-emerald-50/50' : isPast ? 'opacity-60' : ''}`}
              >
                {/* 日付 */}
                <div className="flex-shrink-0 w-16 text-center">
                  <div className={`text-2xl font-bold ${
                    isToday ? 'text-emerald-600' :
                    (holidayName || dow === 0) ? 'text-red-500' :
                    dow === 6 ? 'text-blue-500' : 'text-gray-800'
                  }`}>
                    {d.getDate()}
                  </div>
                  <div className={`text-xs ${
                    isToday ? 'text-emerald-500' :
                    (holidayName || dow === 0) ? 'text-red-400' :
                    dow === 6 ? 'text-blue-400' : 'text-gray-400'
                  }`}>
                    {DOW[dow]}
                  </div>
                  {isToday && (
                    <span className="inline-block mt-1 text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-bold">
                      TODAY
                    </span>
                  )}
                </div>

                {/* イベント内容 */}
                <div className="flex-1 space-y-2">
                  {holidayName && (
                    <div className="text-xs text-red-500 font-bold">{holidayName}</div>
                  )}
                  {isClosure && (
                    <span className="inline-block text-xs bg-orange-400 text-white px-2 py-0.5 rounded font-bold">休館</span>
                  )}
                  {grouped[dateStr].map(evt => (
                    <EventCard key={evt.id} event={evt} />
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

function EventCard({ event }: { event: EventSummary }) {
  const timeStr = event.startTime && event.endTime
    ? `${event.startTime}〜${event.endTime}`
    : event.startTime
      ? `${event.startTime}〜`
      : null;

  const roomStr = event.rooms.length > 0
    ? event.rooms.map(r => shortRoomName(r)).join('・')
    : null;

  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3">
      <div className="font-bold text-gray-800">{event.title}</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
        {timeStr && (
          <span className="flex items-center gap-1">
            <Clock size={12} /> {timeStr}
          </span>
        )}
        {event.eventType === 'facility' && roomStr && (
          <span className="flex items-center gap-1">
            <Home size={12} /> {roomStr}
          </span>
        )}
        {event.eventType === 'general' && event.location && (
          <span className="flex items-center gap-1">
            <MapPin size={12} /> {event.location}
          </span>
        )}
      </div>
      {event.memo && (
        <div className="mt-1 text-xs text-gray-400">{event.memo}</div>
      )}
    </div>
  );
}
