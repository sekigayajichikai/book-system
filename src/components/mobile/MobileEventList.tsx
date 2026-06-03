import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Clock, Home, Users } from 'lucide-react';
import { EventSummary } from '../../types';
import { shortRoomName } from '../../constants';
import { useSwipe } from '../../hooks/useSwipe';

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const dow = date.getDay();
  date.setDate(date.getDate() - (dow === 0 ? 6 : dow - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

interface MobileEventListProps {
  holidays: Record<string, string>;
  closures: Set<string>;
}

export default function MobileEventList({ holidays, closures }: MobileEventListProps) {
  const [subView, setSubView] = useState<'month' | 'week'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
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

  // 週ビュー: weekStartの属する月のデータを取得
  const weekMonth = weekStart.getMonth();
  const weekYear = weekStart.getFullYear();
  const fetchMonth = subView === 'week' ? weekMonth : month;
  const fetchYear = subView === 'week' ? weekYear : year;

  useEffect(() => { fetchEvents(fetchYear, fetchMonth); }, [fetchYear, fetchMonth, fetchEvents]);

  // 週ビューで週末が翌月にまたがる場合、翌月データも取得してマージ
  const [extraEvents, setExtraEvents] = useState<EventSummary[]>([]);
  useEffect(() => {
    if (subView !== 'week') { setExtraEvents([]); return; }
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekEnd.getMonth() !== weekStart.getMonth()) {
      fetch(`/api/events?year=${weekEnd.getFullYear()}&month=${weekEnd.getMonth() + 1}&visibility=public`)
        .then(r => r.ok ? r.json() : []).then(d => setExtraEvents(d || [])).catch(() => setExtraEvents([]));
    } else {
      setExtraEvents([]);
    }
  }, [subView, weekStart]);

  const allEvents = subView === 'week' ? [...events, ...extraEvents] : events;

  useEffect(() => {
    if (!loading && todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading, subView]);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const handlePrevWeek = () => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; });
  const handleNextWeek = () => setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; });

  const containerRef = useRef<HTMLDivElement>(null);
  useSwipe(containerRef, {
    onSwipeLeft: subView === 'week' ? handleNextWeek : handleNextMonth,
    onSwipeRight: subView === 'week' ? handlePrevWeek : handlePrevMonth,
  });

  const majorEvents = allEvents.filter(e => e.isMajor);

  // 日付グループ化
  const grouped: Record<string, EventSummary[]> = {};
  allEvents.forEach(e => {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  });
  const sortedDates = Object.keys(grouped).sort();

  const today = new Date();
  const todayStr = formatDate(today);

  // 週ビュー用: 7日分の日付
  const weekDays: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    weekDays.push(formatDate(d));
  }
  const weekEndDate = new Date(weekStart);
  weekEndDate.setDate(weekEndDate.getDate() + 6);

  return (
    <div ref={containerRef}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={subView === 'week' ? handlePrevWeek : handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={24} className="text-gray-500" />
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-800">
            {subView === 'week'
              ? `${weekStart.getMonth() + 1}/${weekStart.getDate()} 〜 ${weekEndDate.getMonth() + 1}/${weekEndDate.getDate()}`
              : `${year}年 ${month + 1}月`
            }
          </h2>
          <div className="flex bg-gray-100 rounded-full p-0.5">
            {(['month', 'week'] as const).map(v => (
              <button key={v} onClick={() => setSubView(v)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  subView === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
                }`}
              >
                {v === 'month' ? '月' : '週'}
              </button>
            ))}
          </div>
        </div>
        <button onClick={subView === 'week' ? handleNextWeek : handleNextMonth} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronRight size={24} className="text-gray-500" />
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400">読み込み中...</div>
      ) : subView === 'month' ? (
        /* === 月ビュー === */
        <div className="space-y-3">
          {majorEvents.length > 0 && (
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
              <div className="text-sm font-bold text-blue-700 mb-3">主な予定</div>
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
                        <span className={`text-lg font-bold ${dateColor} shrink-0`}>{d.getMonth() + 1}/{d.getDate()}</span>
                        <span className={`text-base ${dowColor} shrink-0`}>({DOW[dow]})</span>
                        <span className="text-base font-bold text-gray-800">{evt.title}</span>
                      </div>
                      {(timeStr || evt.location) && (
                        <div className="flex gap-3 mt-0.5 ml-0.5 text-sm text-gray-600">
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
          <div className="text-sm font-bold text-gray-600 px-1">すべての予定</div>
          {sortedDates.map(dateStr => (
            <DayCard key={dateStr} dateStr={dateStr} events={grouped[dateStr]} todayStr={todayStr} todayRef={todayRef} holidays={holidays} closures={closures} />
          ))}
        </div>
      ) : (
        /* === 週ビュー === */
        <div className="space-y-3">
          {weekDays.map(dateStr => {
            const dayEvents = grouped[dateStr] || [];
            return (
              <WeekDayCard key={dateStr} dateStr={dateStr} events={dayEvents} todayStr={todayStr} todayRef={todayRef} holidays={holidays} closures={closures} />
            );
          })}
        </div>
      )}
    </div>
  );
}

// === 月ビュー用 日カード ===
function DayCard({ dateStr, events, todayStr, todayRef, holidays, closures }: {
  dateStr: string; events: EventSummary[]; todayStr: string;
  todayRef: React.RefObject<HTMLDivElement | null>;
  holidays: Record<string, string>; closures: Set<string>;
}) {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  const isToday = dateStr === todayStr;
  const isPast = dateStr < todayStr;
  const holidayName = holidays[dateStr];
  const isClosure = closures.has(dateStr);

  return (
    <div ref={isToday ? todayRef : undefined}
      className={`rounded-xl border p-4 ${
        isToday ? 'border-blue-400 bg-blue-50/50 ring-2 ring-blue-200' :
        isPast ? 'border-gray-200 bg-white opacity-60' : 'border-gray-200 bg-white'
      }`}>
      <div className="flex items-baseline gap-2 mb-2">
        <span className={`text-2xl font-bold ${isToday ? 'text-blue-600' : (holidayName || dow === 0) ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-800'}`}>
          {d.getMonth() + 1}/{d.getDate()}
        </span>
        <span className={`text-lg ${isToday ? 'text-blue-500' : (holidayName || dow === 0) ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
          ({DOW[dow]})
        </span>
        {isClosure && <span className="text-sm bg-orange-400 text-white px-2 py-0.5 rounded font-bold">休館</span>}
        {holidayName && <span className="text-sm text-red-500 font-bold">{holidayName}</span>}
        {isToday && <span className="text-sm bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">TODAY</span>}
      </div>
      <div className="space-y-2">
        {sortEvents(events).map(evt => (
          <MobileEventCard key={evt.id} event={evt} highlight={evt.isMajor} />
        ))}
      </div>
    </div>
  );
}

// === 週ビュー用 日カード（MobileDayCard準拠のフォーマット） ===
function WeekDayCard({ dateStr, events, todayStr, todayRef, holidays, closures }: {
  dateStr: string; events: EventSummary[]; todayStr: string;
  todayRef: React.RefObject<HTMLDivElement | null>;
  holidays: Record<string, string>; closures: Set<string>;
}) {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  const isToday = dateStr === todayStr;
  const isPast = dateStr < todayStr;
  const holidayName = holidays[dateStr];
  const isClosure = closures.has(dateStr);
  const sorted = sortEvents(events);

  return (
    <div ref={isToday ? todayRef : undefined}
      className={`rounded-xl border ${
        isToday ? 'border-blue-400 bg-blue-50/50 ring-2 ring-blue-200' :
        isClosure ? 'border-gray-200 bg-gray-50' :
        isPast ? 'border-gray-200 bg-white opacity-60' : 'border-gray-200 bg-white'
      }`}>
      {/* 日付ヘッダー（MobileDayCard準拠） */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold ${isToday ? 'text-blue-600' : (holidayName || dow === 0) ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-800'}`}>
            {d.getMonth() + 1}/{d.getDate()}
          </span>
          <span className={`text-lg ${isToday ? 'text-blue-500' : (holidayName || dow === 0) ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
            ({DOW[dow]})
          </span>
          {isClosure && <span className="text-sm bg-orange-400 text-white px-2 py-0.5 rounded font-bold">休館</span>}
          {holidayName && <span className="text-sm text-red-500 font-bold">{holidayName}</span>}
          {isToday && <span className="text-sm bg-blue-600 text-white px-2 py-0.5 rounded-full font-bold">TODAY</span>}
        </div>
      </div>
      {/* イベント */}
      {sorted.length === 0 ? (
        <div className="px-4 pb-3 text-lg text-gray-300">予定なし</div>
      ) : (
        <div className="px-4 pb-3 space-y-3">
          {sorted.map(evt => (
            <WeekEventCard key={evt.id} event={evt} highlight={evt.isMajor} />
          ))}
        </div>
      )}
    </div>
  );
}

// === 週ビュー用 イベントカード（詳細: 時間・タイトル・場所・団体・説明2行） ===
function WeekEventCard({ event, highlight }: { event: EventSummary; highlight?: boolean }) {
  const [descExpanded, setDescExpanded] = useState(false);

  const timeStr = event.startTime && event.endTime
    ? `${event.startTime}〜${event.endTime}`
    : event.startTime ? `${event.startTime}〜`
    : event.slots.length > 0 ? event.slots.join('・') : null;

  const roomStr = event.rooms.length > 0 ? event.rooms.map(r => shortRoomName(r)).join('・') : null;
  const locationStr = event.eventType === 'facility'
    ? (event.location && roomStr ? `${event.location}（${roomStr}）` : event.location || roomStr)
    : event.location || null;

  const descText = event.description || null;

  return (
    <div className={`rounded-lg px-3 py-2.5 ${highlight ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
      {/* 時間帯ヘッダー */}
      <div className="text-gray-600 mb-1">
        {timeStr ? (
          <span className="text-lg font-bold">{timeStr}</span>
        ) : (
          <span className="text-lg font-bold text-gray-400">終日</span>
        )}
      </div>
      {/* タイトル */}
      <div className={`text-lg ${highlight ? 'font-bold text-blue-800' : 'font-bold text-gray-800'}`}>{event.title}</div>
      {/* 場所・団体 */}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-base text-gray-600">
        {locationStr && <span className="flex items-center gap-1"><MapPin size={14} /> {locationStr}</span>}
        {event.memo && <span className="flex items-center gap-1"><Users size={14} /> {event.memo}</span>}
      </div>
      {/* 説明（2行 + 続きを読む） */}
      {descText && (
        <div className="mt-1.5">
          {descExpanded ? (
            <>
              <div className="text-base text-gray-400 whitespace-pre-wrap">{descText}</div>
              <button onClick={() => setDescExpanded(false)} className="text-sm text-blue-500 mt-0.5">閉じる</button>
            </>
          ) : (
            <>
              <div className="text-base text-gray-400 line-clamp-2">{descText}</div>
              <button onClick={() => setDescExpanded(true)} className="text-sm text-blue-500 mt-0.5">続きを読む</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// === 月ビュー用 イベントカード（説明1行トグル） ===
function MobileEventCard({ event, highlight }: { event: EventSummary; highlight?: boolean }) {
  const [descExpanded, setDescExpanded] = useState(false);

  const timeStr = event.startTime && event.endTime
    ? `${event.startTime}〜${event.endTime}`
    : event.startTime ? `${event.startTime}〜`
    : event.slots.length > 0 ? event.slots.join('・') : null;

  const roomStr = event.rooms.length > 0 ? event.rooms.map(r => shortRoomName(r)).join('・') : null;
  const descText = event.description || null;

  return (
    <div className={`rounded-lg px-3 py-2.5 ${highlight ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
      <div className={`text-base ${highlight ? 'font-bold text-blue-800' : 'font-bold text-gray-800'}`}>{event.title}</div>
      {event.memo && <div className="text-sm text-gray-400 mt-0.5">{event.memo}</div>}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-sm text-gray-600">
        {timeStr && <span className="flex items-center gap-1"><Clock size={14} /> {timeStr}</span>}
        {event.eventType === 'facility' && (event.location || roomStr) && (
          <span className="flex items-center gap-1"><Home size={14} /> {event.location && roomStr ? `${event.location}（${roomStr}）` : event.location || roomStr}</span>
        )}
        {event.eventType === 'general' && event.location && <span className="flex items-center gap-1"><MapPin size={14} /> {event.location}</span>}
      </div>
      {descText && (
        <div className="mt-1.5">
          {descExpanded ? (
            <>
              <div className="text-sm text-gray-400 whitespace-pre-wrap">{descText}</div>
              <button onClick={() => setDescExpanded(false)} className="text-xs text-blue-500 mt-0.5">閉じる</button>
            </>
          ) : (
            <button onClick={() => setDescExpanded(true)} className="text-sm text-gray-400 w-full text-left flex items-baseline gap-0.5">
              <span className="truncate">{descText}</span>
              <span className="text-xs text-blue-500 shrink-0 ml-1">続きを読む</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// === ソートヘルパー ===
function sortEvents(events: EventSummary[]): EventSummary[] {
  return [...events].sort((a, b) => {
    if (a.isMajor !== b.isMajor) return a.isMajor ? -1 : 1;
    if (!a.startTime && b.startTime) return -1;
    if (a.startTime && !b.startTime) return 1;
    return (a.startTime || '').localeCompare(b.startTime || '');
  });
}
