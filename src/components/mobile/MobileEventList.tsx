import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Clock, Home, ChevronDown, ChevronUp } from 'lucide-react';
import { EventSummary } from '../../types';
import { shortRoomName } from '../../constants';
import { useSwipe } from '../../hooks/useSwipe';

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

type ViewPattern = 'A' | 'B' | 'C';

interface MobileEventListProps {
  holidays: Record<string, string>;
  closures: Set<string>;
}

export default function MobileEventList({ holidays, closures }: MobileEventListProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [pattern, setPattern] = useState<ViewPattern>('A');
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
  const allEvents = events;

  // 日付グループ化
  const grouped: Record<string, EventSummary[]> = {};
  allEvents.forEach(e => {
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

      {/* パターン切り替え（テスト用） */}
      <div className="flex items-center justify-center gap-1 mb-4">
        {(['A', 'B', 'C'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPattern(p)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              pattern === p ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400">読み込み中...</div>
      ) : (
        <>
          {pattern === 'A' && <PatternA majorEvents={majorEvents} grouped={grouped} sortedDates={sortedDates} todayStr={todayStr} todayRef={todayRef} holidays={holidays} closures={closures} />}
          {pattern === 'B' && <PatternB majorEvents={majorEvents} grouped={grouped} sortedDates={sortedDates} todayStr={todayStr} todayRef={todayRef} holidays={holidays} closures={closures} />}
          {pattern === 'C' && <PatternC majorEvents={majorEvents} grouped={grouped} sortedDates={sortedDates} todayStr={todayStr} todayRef={todayRef} holidays={holidays} closures={closures} />}
        </>
      )}
    </div>
  );
}

// === 共通型 ===
interface PatternProps {
  majorEvents: EventSummary[];
  grouped: Record<string, EventSummary[]>;
  sortedDates: string[];
  todayStr: string;
  todayRef: React.RefObject<HTMLDivElement | null>;
  holidays: Record<string, string>;
  closures: Set<string>;
}

// === パターンA: 主な予定を上部固定 + 全予定リスト ===
function PatternA({ majorEvents, grouped, sortedDates, todayStr, todayRef, holidays, closures }: PatternProps) {
  return (
    <div className="space-y-3">
      {/* 主な予定セクション */}
      {majorEvents.length > 0 && (
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
          <div className="text-xs font-bold text-emerald-600 mb-2">主な予定</div>
          <div className="space-y-2">
            {majorEvents.map(evt => {
              const d = new Date(evt.date + 'T00:00:00');
              return (
                <div key={evt.id} className="flex items-center gap-3">
                  <span className="text-sm font-bold text-emerald-700 w-16 shrink-0">
                    {d.getMonth() + 1}/{d.getDate()}({DOW[d.getDay()]})
                  </span>
                  <span className="font-bold text-gray-800">{evt.title}</span>
                  {evt.startTime && <span className="text-xs text-gray-400">{evt.startTime}〜</span>}
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
  );
}

// === パターンB: 主な予定カード + 「すべて見る」展開 ===
function PatternB({ majorEvents, grouped, sortedDates, todayStr, todayRef, holidays, closures }: PatternProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-3">
      {/* 主な予定カード */}
      {majorEvents.length > 0 ? (
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
          <div className="text-xs font-bold text-emerald-600 mb-2">主な予定</div>
          <div className="space-y-2">
            {majorEvents.map(evt => {
              const d = new Date(evt.date + 'T00:00:00');
              return (
                <div key={evt.id} className="bg-white rounded-lg px-3 py-2.5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-emerald-700">
                      {d.getMonth() + 1}/{d.getDate()}({DOW[d.getDay()]})
                    </span>
                    <span className="font-bold text-gray-800">{evt.title}</span>
                  </div>
                  {(evt.startTime || evt.location) && (
                    <div className="flex gap-3 mt-1 text-xs text-gray-500">
                      {evt.startTime && <span><Clock size={12} className="inline -mt-0.5" /> {evt.startTime}{evt.endTime ? `〜${evt.endTime}` : '〜'}</span>}
                      {evt.location && <span><MapPin size={12} className="inline -mt-0.5" /> {evt.location}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-gray-400 text-sm">主な予定はありません</div>
      )}

      {/* すべて見るトグル */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 bg-gray-50 rounded-lg"
      >
        {expanded ? (
          <><ChevronUp size={16} /> すべての予定を閉じる</>
        ) : (
          <><ChevronDown size={16} /> すべての予定を見る ({sortedDates.length}日分)</>
        )}
      </button>

      {/* 展開時: 全予定リスト */}
      {expanded && (
        <div className="space-y-3">
          {sortedDates.map(dateStr => (
            <DayCard key={dateStr} dateStr={dateStr} events={grouped[dateStr]} todayStr={todayStr} todayRef={todayRef} holidays={holidays} closures={closures} />
          ))}
        </div>
      )}
    </div>
  );
}

// === パターンC: タブ切り替え ===
function PatternC({ majorEvents, grouped, sortedDates, todayStr, todayRef, holidays, closures }: PatternProps) {
  const [tab, setTab] = useState<'major' | 'all'>('major');

  // 主な予定の日付グループ
  const majorGrouped: Record<string, EventSummary[]> = {};
  majorEvents.forEach(e => {
    if (!majorGrouped[e.date]) majorGrouped[e.date] = [];
    majorGrouped[e.date].push(e);
  });
  const majorDates = Object.keys(majorGrouped).sort();

  return (
    <div className="space-y-3">
      {/* タブ */}
      <div className="flex bg-gray-100 rounded-full p-1">
        <button
          onClick={() => setTab('major')}
          className={`flex-1 py-2 rounded-full text-sm font-bold transition-all ${
            tab === 'major' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
          }`}
        >
          主な予定
        </button>
        <button
          onClick={() => setTab('all')}
          className={`flex-1 py-2 rounded-full text-sm font-bold transition-all ${
            tab === 'all' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
          }`}
        >
          すべての予定
        </button>
      </div>

      {/* コンテンツ */}
      {tab === 'major' ? (
        majorDates.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">主な予定はありません</div>
        ) : (
          <div className="space-y-3">
            {majorDates.map(dateStr => (
              <DayCard key={dateStr} dateStr={dateStr} events={majorGrouped[dateStr]} todayStr={todayStr} todayRef={todayRef} holidays={holidays} closures={closures} majorOnly />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {sortedDates.map(dateStr => (
            <DayCard key={dateStr} dateStr={dateStr} events={grouped[dateStr]} todayStr={todayStr} todayRef={todayRef} holidays={holidays} closures={closures} />
          ))}
        </div>
      )}
    </div>
  );
}

// === 日カード（共通） ===
function DayCard({ dateStr, events, todayStr, todayRef, holidays, closures, majorOnly }: {
  dateStr: string;
  events: EventSummary[];
  todayStr: string;
  todayRef: React.RefObject<HTMLDivElement | null>;
  holidays: Record<string, string>;
  closures: Set<string>;
  majorOnly?: boolean;
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
          <MobileEventCard key={evt.id} event={evt} highlight={!majorOnly && evt.isMajor} />
        ))}
      </div>
    </div>
  );
}

// === イベントカード ===
function MobileEventCard({ event, highlight }: { event: EventSummary; highlight?: boolean }) {
  const timeStr = event.startTime && event.endTime
    ? `${event.startTime}〜${event.endTime}`
    : event.startTime ? `${event.startTime}〜` : null;

  const roomStr = event.rooms.length > 0
    ? event.rooms.map(r => shortRoomName(r)).join('・') : null;

  return (
    <div className={`rounded-lg px-3 py-2.5 ${highlight ? 'bg-emerald-100 border border-emerald-200' : 'bg-gray-50'}`}>
      <div className={`text-base ${highlight ? 'font-bold text-emerald-800' : 'font-bold text-gray-800'}`}>{event.title}</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-sm text-gray-500">
        {timeStr && <span className="flex items-center gap-1"><Clock size={14} /> {timeStr}</span>}
        {event.eventType === 'facility' && roomStr && <span className="flex items-center gap-1"><Home size={14} /> {roomStr}</span>}
        {event.eventType === 'general' && event.location && <span className="flex items-center gap-1"><MapPin size={14} /> {event.location}</span>}
      </div>
      {event.memo && <div className="mt-1 text-sm text-gray-400">{event.memo}</div>}
    </div>
  );
}
