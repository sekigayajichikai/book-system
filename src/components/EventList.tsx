import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { EventSummary } from '../types';
import { shortRoomName } from '../constants';

const WEEK_DAYS = ['月', '火', '水', '木', '金', '土', '日'];

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface EventListProps {
  holidays: Record<string, string>;
  closures: Set<string>;
}

export default function EventList({ holidays, closures }: EventListProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalDate, setModalDate] = useState<Date | null>(null);

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
          onClick={() => dayEvents.length > 0 && setModalDate(new Date(year, month, day))}
          className={`min-h-[8rem] border border-gray-200 relative transition-colors flex flex-col ${
            dayEvents.length > 0 ? 'cursor-pointer hover:bg-emerald-50/30' : ''
          } ${isToday ? 'outline outline-2 outline-emerald-400 -outline-offset-1 z-10' : ''} ${isClosure ? 'bg-gray-50' : ''}`}
        >
          {/* 日付 */}
          <div className="px-1 pt-0.5 shrink-0 flex items-center gap-1 overflow-hidden">
            <span className={`text-xs font-bold ${
              isToday ? 'bg-emerald-600 text-white px-1 rounded' :
              (isHoliday || dow === 0) ? 'text-red-500' :
              dow === 6 ? 'text-blue-500' : 'text-gray-600'
            }`}>
              {day}
            </span>
            {isClosure && <span className="text-[10px] bg-orange-400 text-white px-1.5 py-px rounded font-bold shrink-0 whitespace-nowrap">休館</span>}
            {holidayName && <span className="text-xs text-red-400 truncate min-w-0">{holidayName}</span>}
          </div>

          {/* イベント */}
          <div className="flex-1 px-0.5 py-0.5 overflow-hidden space-y-px">
            {dayEvents.slice(0, MAX_DISPLAY).map(evt => (
              <div key={evt.id} className="text-xs text-gray-700 rounded flex items-center gap-1 px-0.5 py-px overflow-hidden">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  evt.eventType === 'general' ? 'bg-emerald-400' : 'bg-violet-400'
                }`} />
                <span className="truncate">{evt.title}</span>
              </div>
            ))}
            {dayEvents.length > MAX_DISPLAY && (
              <div className="text-xs text-gray-400 pl-1">+{dayEvents.length - MAX_DISPLAY}</div>
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
            <h2 className="text-[22px] font-normal text-gray-800">
              {year}年 {month + 1}月
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

        {loading && (
          <div className="p-4 text-center text-gray-500 text-sm">読み込み中...</div>
        )}

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
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-violet-400 rounded-full" />会館利用</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-400 rounded-full" />その他の予定</span>
        </div>
      </div>

      {/* 日付クリック時のモーダル */}
      {modalDate && (
        <EventDayModal
          date={modalDate}
          events={eventsByDate[formatDate(modalDate)] || []}
          onClose={() => setModalDate(null)}
        />
      )}
    </>
  );
}

/** 日別イベント詳細モーダル */
function EventDayModal({ date, events, onClose }: { date: Date; events: EventSummary[]; onClose: () => void }) {
  const dow = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">
            {date.getMonth() + 1}月{date.getDate()}日({dow})の予定
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {events.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">予定はありません</p>
          ) : (
            events.map(evt => {
              const timeStr = evt.startTime && evt.endTime
                ? `${evt.startTime}〜${evt.endTime}`
                : null;
              const roomStr = evt.rooms.length > 0
                ? evt.rooms.map(r => shortRoomName(r)).join('・')
                : null;

              return (
                <div key={evt.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      evt.eventType === 'general' ? 'bg-emerald-400' : 'bg-violet-400'
                    }`} />
                    <span className="font-bold text-gray-800">{evt.title}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 ml-4 text-xs text-gray-500">
                    {timeStr && <span>{timeStr}</span>}
                    {evt.eventType === 'facility' && roomStr && <span>{roomStr}</span>}
                    {evt.eventType === 'general' && evt.location && <span>{evt.location}</span>}
                  </div>
                  {evt.memo && <div className="mt-1 ml-4 text-xs text-gray-400">{evt.memo}</div>}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
