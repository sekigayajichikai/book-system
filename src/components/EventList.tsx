import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Clock, MapPin } from 'lucide-react';
import { EventSummary } from '../types';
import { shortRoomName } from '../constants';

const WEEK_DAYS = ['月', '火', '水', '木', '金', '土', '日'];

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface EventListProps {
  holidays: Record<string, string>;
  closures: Set<string>;
  onDateClick?: (date: Date) => void;
  onCellClick?: (date: Date, rect: DOMRect) => void;
  onItemClick?: (event: EventSummary, rect: DOMRect) => void;
  refreshKey?: number;
}

function isMajorEvent(evt: { isMajor?: boolean }): boolean {
  return evt.isMajor === true;
}

export default function EventList({ holidays, closures, onDateClick, onCellClick, onItemClick, refreshKey }: EventListProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalDate, setModalDate] = useState<Date | null>(null);
  const [modalAnchor, setModalAnchor] = useState<DOMRect | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

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
  }, [year, month, fetchEvents, refreshKey]);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // 日付→イベントのマップ
  const eventsByDate: Record<string, EventSummary[]> = {};
  events.forEach(e => {
    if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
    eventsByDate[e.date].push(e);
  });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;

  const generateCalendarDays = () => {
    const days = [];

    // 空セル（前月分）
    for (let i = 0; i < mondayOffset; i++) {
      days.push(<div key={`empty-${i}`} className="min-h-[6.5rem] bg-gray-50 border border-gray-100" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = eventsByDate[dateStr] || [];
      const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
      const dow = new Date(year, month, day).getDay();
      const holidayName = holidays[dateStr];
      const isHoliday = !!holidayName;
      const isClosure = closures.has(dateStr);
      const MAX_DISPLAY = 3;

      days.push(
        <div
          key={day}
          onClick={(e) => {
            setSelectedEventId(null);
            const d = new Date(year, month, day);
            if (onCellClick) {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              onCellClick(d, rect);
            } else if (onDateClick) { onDateClick(d); }
            else if (dayEvents.length > 0) {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              setModalDate(d);
              setModalAnchor(rect);
            }
          }}
          className={`min-h-[8rem] border border-gray-200 relative transition-colors flex flex-col ${
            onCellClick || onDateClick || dayEvents.length > 0 ? 'cursor-pointer hover:bg-blue-50/30' : ''
          } ${isToday ? 'outline outline-2 outline-blue-400 -outline-offset-1 z-10' : ''} ${isClosure ? 'bg-gray-50' : ''}`}
        >
          {/* 日付 */}
          <div className="px-1 pt-0.5 shrink-0 flex items-center gap-1 overflow-hidden">
            <span className={`text-xs font-bold ${
              isToday ? 'bg-blue-600 text-white px-1 rounded' :
              (isHoliday || dow === 0) ? 'text-red-500' :
              dow === 6 ? 'text-blue-500' : 'text-gray-600'
            }`}>
              {day}
            </span>
            {isClosure && <span className="text-[10px] bg-orange-400 text-white px-1.5 py-px rounded font-bold shrink-0 whitespace-nowrap">休館</span>}
            {holidayName && <span className="text-xs text-red-400 truncate min-w-0">{holidayName}</span>}
          </div>

          {/* イベント: 主要=カラー背景ラベル、詳細=グレードット */}
          <div className="flex-1 px-0.5 py-0.5 overflow-hidden space-y-px">
            {dayEvents.filter(e => isMajorEvent(e)).map(evt => (
              <div key={evt.id} onClick={e => { if (onItemClick) { e.stopPropagation(); setSelectedEventId(evt.id); onItemClick(evt, (e.currentTarget as HTMLElement).getBoundingClientRect()); } }}
                className={`text-xs font-bold rounded px-1 py-0.5 truncate cursor-pointer transition-colors ${
                  selectedEventId === evt.id ? 'bg-blue-200 text-blue-900' : 'text-blue-700 bg-blue-100 hover:bg-blue-200'
                }`}>
                {evt.title}
              </div>
            ))}
            {dayEvents.filter(e => !isMajorEvent(e)).slice(0, MAX_DISPLAY).map(evt => (
              <div key={evt.id} onClick={e => { if (onItemClick) { e.stopPropagation(); setSelectedEventId(evt.id); onItemClick(evt, (e.currentTarget as HTMLElement).getBoundingClientRect()); } }}
                className={`text-xs text-gray-800 rounded flex items-center gap-1 px-0.5 py-px overflow-hidden cursor-pointer transition-colors ${
                  selectedEventId === evt.id ? 'bg-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)] rounded-sm relative z-10' : 'hover:bg-gray-200'
                }`}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-gray-300" />
                <span className="truncate">{evt.title}</span>
              </div>
            ))}
            {dayEvents.filter(e => !isMajorEvent(e)).length > MAX_DISPLAY && (
              <div className="text-xs text-gray-400 pl-1">+{dayEvents.filter(e => !isMajorEvent(e)).length - MAX_DISPLAY}</div>
            )}
          </div>
        </div>,
      );
    }

    return days;
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <div className="flex items-center gap-2">
            <h2 className="text-[22px] font-normal text-gray-800 flex items-center gap-2">
              {year}年 {month + 1}月
              {loading && <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />}
            </h2>
            <div className="flex gap-1">
              <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ChevronLeft size={20} className="text-gray-500" />
              </button>
              <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ChevronRight size={20} className="text-gray-500" />
              </button>
            </div>
          </div>
        </div>

        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 text-center bg-gray-50 border-b border-gray-200">
          {WEEK_DAYS.map((d, i) => (
            <div key={d} className={`py-2 text-sm font-bold ${i === 6 ? 'text-red-500' : i === 5 ? 'text-blue-500' : 'text-gray-600'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* カレンダーグリッド */}
        <div className="grid grid-cols-7">
          {generateCalendarDays()}
        </div>

        {/* 凡例 */}
        <div className="flex flex-wrap gap-3 p-3 border-t border-gray-100 text-xs text-gray-500 items-center">
          <span className="flex items-center gap-1"><span className="w-4 h-3 bg-blue-100 rounded text-[8px] text-blue-700 font-bold flex items-center justify-center">例</span>主な予定</span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />詳細予定</span>
        </div>
      </div>

      {/* 日付クリック時のポップオーバー */}
      {modalDate && (
        <EventDayPopover
          date={modalDate}
          events={eventsByDate[formatDate(modalDate)] || []}
          anchorRect={modalAnchor}
          onClose={() => { setModalDate(null); setModalAnchor(null); }}
        />
      )}
    </>
  );
}

/** 日別イベント詳細ポップオーバー */
function EventDayPopover({ date, events, anchorRect, onClose }: { date: Date; events: EventSummary[]; anchorRect: DOMRect | null; onClose: () => void }) {
  const dow = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];

  if (events.length === 0) return null;

  let style: React.CSSProperties = {};
  if (anchorRect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchorRect.left + anchorRect.width + 8;
    if (left + 340 > vw - 16) left = anchorRect.left - 340 - 8;
    if (left < 16) left = 16;
    let top = anchorRect.top;
    if (top + 300 > vh - 16) top = vh - 300 - 16;
    if (top < 16) top = 16;
    style = { position: 'fixed', left, top, zIndex: 50, width: 340 };
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-[70vh] flex flex-col" style={style}>
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h3 className="text-base font-bold text-gray-800">
            {date.getMonth() + 1}月{date.getDate()}日({dow})
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* イベント一覧 */}
        <div className="flex-1 overflow-auto px-4 pb-3 divide-y divide-gray-100">
          {events.map(evt => {
            const timeStr = evt.startTime && evt.endTime ? `${evt.startTime}〜${evt.endTime}` : null;
            const roomStr = evt.rooms.length > 0 ? evt.rooms.map(r => shortRoomName(r)).join('・') : null;
            const locationStr = evt.eventType === 'facility' ? roomStr : evt.location;

            return (
              <div key={evt.id} className="py-2.5 first:pt-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${
                    evt.isMajor ? 'bg-blue-500' : evt.eventType === 'general' ? 'bg-blue-400' : 'bg-gray-400'
                  }`} />
                  <span className="text-sm font-medium text-gray-900">{evt.title}</span>
                </div>
                <div className="flex items-center gap-4 mt-1 pl-[18px]">
                  {timeStr && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock size={12} className="text-gray-400" />
                      {timeStr}
                    </span>
                  )}
                  {locationStr && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin size={12} className="text-gray-400" />
                      {locationStr}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
