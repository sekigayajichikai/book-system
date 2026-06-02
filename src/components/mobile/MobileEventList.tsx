import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Clock, Home, ChevronDown } from 'lucide-react';
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

  useEffect(() => { fetchEvents(year, month); }, [year, month, fetchEvents]);

  useEffect(() => {
    if (!loading && todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading]);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const containerRef = useRef<HTMLDivElement>(null);
  useSwipe(containerRef, { onSwipeLeft: handleNextMonth, onSwipeRight: handlePrevMonth });

  const majorEvents = events.filter(e => e.isMajor);

  // 日付グループ化
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
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={24} className="text-gray-500" />
        </button>
        <h2 className="text-lg font-bold text-gray-800">
          {year}年 {month + 1}月
        </h2>
        <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronRight size={24} className="text-gray-500" />
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400">読み込み中...</div>
      ) : (
        <div className="space-y-3">
          {/* 主な予定カード（1枚にまとめる） */}
          {majorEvents.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs font-bold text-gray-400 mb-3">主な予定</div>
              <div className="space-y-2.5">
                {majorEvents.map(evt => {
                  const d = new Date(evt.date + 'T00:00:00');
                  const dow = d.getDay();
                  const hol = holidays[evt.date];
                  const dateColor = (hol || dow === 0) ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-800';
                  const dowColor = (hol || dow === 0) ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-gray-400';
                  const timeStr = evt.startTime && evt.endTime ? `${evt.startTime}〜${evt.endTime}` : evt.startTime ? `${evt.startTime}〜` : null;
                  return (
                    <div key={evt.id}>
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-lg font-bold ${dateColor} shrink-0`}>
                          {d.getMonth() + 1}/{d.getDate()}
                        </span>
                        <span className={`text-base ${dowColor} shrink-0`}>({DOW[dow]})</span>
                        <span className="text-base font-bold text-gray-800 flex-1 truncate ml-1">{evt.title}</span>
                      </div>
                      {(timeStr || evt.location) && (
                        <div className="flex gap-3 mt-0.5 ml-0.5 text-sm text-gray-400">
                          {timeStr && <span>{timeStr}</span>}
                          {evt.location && <span>{evt.location}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 全予定リスト */}
          <div className="text-xs font-bold text-gray-400 px-1">すべての予定</div>
          {sortedDates.map(dateStr => (
            <DayCard key={dateStr} dateStr={dateStr} events={grouped[dateStr]} todayStr={todayStr} todayRef={todayRef} holidays={holidays} closures={closures} />
          ))}
        </div>
      )}
    </div>
  );
}

// === 日カード ===
function DayCard({ dateStr, events, todayStr, todayRef, holidays, closures }: {
  dateStr: string;
  events: EventSummary[];
  todayStr: string;
  todayRef: React.RefObject<HTMLDivElement | null>;
  holidays: Record<string, string>;
  closures: Set<string>;
}) {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  const isToday = dateStr === todayStr;
  const isPast = dateStr < todayStr;
  const holidayName = holidays[dateStr];
  const isClosure = closures.has(dateStr);

  return (
    <div
      ref={isToday ? todayRef : undefined}
      className={`rounded-xl border p-4 ${
        isToday ? 'border-emerald-400 bg-emerald-50/50 ring-2 ring-emerald-200' :
        isPast ? 'border-gray-200 bg-white opacity-60' :
        'border-gray-200 bg-white'
      }`}
    >
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
      <div className="space-y-2">
        {events.map(evt => (
          <MobileEventCard key={evt.id} event={evt} highlight={evt.isMajor} />
        ))}
      </div>
    </div>
  );
}

// === イベントカード（説明トグル付き） ===
function MobileEventCard({ event, highlight }: { event: EventSummary; highlight?: boolean }) {
  const [descExpanded, setDescExpanded] = useState(false);

  const timeStr = event.startTime && event.endTime
    ? `${event.startTime}〜${event.endTime}`
    : event.startTime ? `${event.startTime}〜`
    : event.slots.length > 0 ? event.slots.join('・') : null;

  const roomStr = event.rooms.length > 0
    ? event.rooms.map(r => shortRoomName(r)).join('・') : null;

  const descText = event.description || null;

  return (
    <div className={`rounded-lg px-3 py-2.5 ${highlight ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
      <div className={`text-base ${highlight ? 'font-bold text-blue-800' : 'font-bold text-gray-800'}`}>{event.title}</div>
      {event.memo && <div className="text-sm text-gray-400 mt-0.5">{event.memo}</div>}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-sm text-gray-500">
        {timeStr && <span className="flex items-center gap-1"><Clock size={14} /> {timeStr}</span>}
        {event.eventType === 'facility' && roomStr && <span className="flex items-center gap-1"><Home size={14} /> {roomStr}</span>}
        {event.eventType === 'general' && event.location && <span className="flex items-center gap-1"><MapPin size={14} /> {event.location}</span>}
      </div>
      {descText && (
        <div className="mt-1.5">
          <div className={`text-sm text-gray-400 ${!descExpanded ? 'line-clamp-1' : ''}`}>{descText}</div>
          {descText.length > 30 && (
            <button onClick={() => setDescExpanded(!descExpanded)} className="text-xs text-blue-500 mt-0.5 flex items-center gap-0.5">
              {descExpanded ? '閉じる' : <>続きを読む <ChevronDown size={12} /></>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
