import { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Clock, MapPin } from 'lucide-react';
import { Booking } from '../types';
import { ROOMS, TIME_SLOTS, shortRoomName } from '../constants';

interface CalendarProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  bookings: Booking[];
  onDateClick: (date: Date) => void;
  onCellClick?: (date: Date, rect: DOMRect) => void;
  onItemClick?: (booking: Booking, rect: DOMRect) => void;
  holidays?: Record<string, string>;
  closures?: Set<string>;
  disableModal?: boolean;
  loading?: boolean;
}

const ROOM_COLORS: Record<string, { bg: string; bar: string }> = {
  '会議室':       { bg: 'bg-[var(--room-kaigi)]', bar: 'bg-yellow-400' },
  '和室（畳側）':  { bg: 'bg-[var(--room-washi)]', bar: 'bg-sky-400' },
  '和室（椅子側）': { bg: 'bg-[var(--room-washi)]', bar: 'bg-sky-400' },
  '図書室':       { bg: 'bg-[var(--room-tosho)]', bar: 'bg-pink-400' },
};

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** --- Day Detail Popover (月カレンダーのセルクリック用・ポップオーバー) --- */
const DayDetailPopover: React.FC<{
  date: Date;
  bookings: Booking[];
  anchorRect: DOMRect | null;
  onClose: () => void;
}> = ({ date, bookings, anchorRect, onClose }) => {
  const dow = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  const ref = useRef<HTMLDivElement>(null);

  const dayBookings = bookings.filter(b => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return b.date === dateStr;
  });

  if (dayBookings.length === 0) return null;

  // ポップオーバー位置計算
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
      <div ref={ref} className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-[70vh] flex flex-col" style={style}>
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
          {dayBookings.map((b, i) => {
            const colors = ROOM_COLORS[b.room] || { bar: 'bg-gray-400' };
            return (
              <div key={i} className="py-2.5 first:pt-0">
                <div className="flex items-center gap-2">
                  <span className={`${colors.bar} w-2.5 h-2.5 rounded-sm shrink-0`} />
                  <span className="text-sm font-medium text-gray-900">{b.title}</span>
                </div>
                <div className="flex items-center gap-4 mt-1 pl-[18px]">
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock size={12} className="text-gray-400" />
                    {b.startTime}〜{b.endTime}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <MapPin size={12} className="text-gray-400" />
                    {shortRoomName(b.room)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

/** --- Weekly Sub-View (月カレンダー内の週表示) --- */
const CalendarWeeklyView: React.FC<{
  weekStart: Date;
  bookings: Booking[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  holidays?: Record<string, string>;
}> = ({ weekStart, bookings, onPrevWeek, onNextWeek, holidays = {} }) => {
  const weekDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    weekDates.push(d);
  }

  const dowNames = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div>
      {/* Week nav */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrevWeek} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <span className="text-sm font-bold text-gray-700">
          {weekDates[0].getMonth() + 1}月{weekDates[0].getDate()}日 〜 {weekDates[6].getMonth() + 1}月{weekDates[6].getDate()}日
        </span>
        <button onClick={onNextWeek} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronRight size={20} className="text-gray-500" />
        </button>
      </div>

      {/* 7-column grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Header */}
        {weekDates.map((date, i) => {
          const dow = date.getDay();
          const today = new Date().toDateString() === date.toDateString();
          const hName = holidays[formatDate(date)];
          const isH = !!hName;
          return (
            <div key={i} className={`text-center py-1.5 rounded-lg ${today ? 'bg-emerald-600 text-white' : ''}`}>
              <div className={`text-xs font-medium ${
                today ? 'text-emerald-100' : (isH || dow === 0) ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-500'
              }`}>
                {dowNames[dow]}
              </div>
              <div className={`text-sm font-bold ${today ? 'text-white' : (isH || dow === 0) ? 'text-red-500' : 'text-gray-800'}`}>
                {date.getDate()}
              </div>
              {hName && !today && <div className="text-xs text-red-400 truncate">{hName}</div>}
            </div>
          );
        })}

        {/* Day columns */}
        {weekDates.map((date, i) => {
          const dateStr = formatDate(date);
          const dayBookings = bookings.filter(b => b.date === dateStr);
          const dow = date.getDay();
          const today = new Date().toDateString() === date.toDateString();

          // Group by slot
          const slotGroups = TIME_SLOTS.map(slot => ({
            slot,
            items: dayBookings.filter(b => b.startTime === slot.startTime),
          })).filter(g => g.items.length > 0);

          return (
            <div
              key={i}
              className={`min-h-[10rem] border border-gray-200 rounded-lg p-1 ${
                today ? 'outline outline-2 outline-emerald-400 -outline-offset-1' : ''
              } ${dow === 0 || dow === 6 ? 'bg-gray-50/50' : ''}`}
            >
              {slotGroups.length === 0 ? (
                <div className="text-xs text-gray-300 text-center mt-4">-</div>
              ) : (
                <div className="space-y-1.5">
                  {slotGroups.map(({ slot, items }) => (
                    <div key={slot.id}>
                      <div className="text-xs font-bold text-gray-400 px-0.5">{slot.gasKey}</div>
                      {items.map((b, j) => {
                        const colors = ROOM_COLORS[b.room] || { bar: 'bg-gray-400' };
                        return (
                          <div key={j} className="flex items-start gap-1 px-0.5 py-px">
                            <span className={`${colors.bar} w-1.5 h-1.5 rounded-full shrink-0 mt-1`} />
                            <span className="text-xs leading-tight text-gray-700">{b.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500 items-center">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-yellow-400 rounded-full" />会議室</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-sky-400 rounded-full" />和室</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-pink-400 rounded-full" />図書室</span>
      </div>
    </div>
  );
};

/** --- Main Calendar Component --- */
const Calendar: React.FC<CalendarProps> = ({
  currentDate, onPrevMonth, onNextMonth, bookings, onDateClick, onCellClick, onItemClick, holidays = {}, closures = new Set(), disableModal, loading,
}) => {
  const [subView, setSubView] = useState<'month' | 'week'>('month');
  const [modalDate, setModalDate] = useState<Date | null>(null);
  const [modalAnchor, setModalAnchor] = useState<DOMRect | null>(null);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const weekDays = ['月', '火', '水', '木', '金', '土', '日'];

  const amSlot = TIME_SLOTS.find(s => s.gasKey === '午前');
  const pmSlot = TIME_SLOTS.find(s => s.gasKey === '午後');

  const handleCellClick = (day: number, e: React.MouseEvent) => {
    const date = new Date(year, month, day);
    if (onCellClick) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      onCellClick(date, rect);
    } else if (disableModal) {
      onDateClick(date);
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setModalDate(date);
      setModalAnchor(rect);
    }
  };

  const handleItemClick = (e: React.MouseEvent, booking: Booking) => {
    if (!onItemClick) return;
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    onItemClick(booking, rect);
  };

  const generateCalendarDays = () => {
    const days = [];

    const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < mondayOffset; i++) {
      days.push(<div key={`empty-${i}`} className="min-h-[6.5rem] bg-gray-50 border border-gray-100" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayBookings = bookings.filter(b => b.date === dateStr);
      const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
      const dow = new Date(year, month, day).getDay();
      const holidayName = holidays[dateStr];
      const isHoliday = !!holidayName;
      const isClosure = closures.has(dateStr);

      const amBookings = dayBookings.filter(b => amSlot && b.startTime === amSlot.startTime);
      const pmBookings = dayBookings.filter(b => pmSlot && b.startTime === pmSlot.startTime);

      days.push(
        <div
          key={day}
          onClick={(e) => handleCellClick(day, e)}
          className={`min-h-[8rem] border border-gray-200 relative cursor-pointer hover:bg-emerald-50/30 transition-colors flex flex-col ${isToday ? 'outline outline-2 outline-emerald-400 -outline-offset-1 z-10' : ''} ${isClosure ? 'bg-gray-50' : ''}`}
        >
          {/* Date number */}
          <div className="px-1 pt-0.5 shrink-0 flex items-center gap-1 overflow-hidden">
            <span className={`text-xs font-bold ${
              isToday ? 'bg-emerald-600 text-white px-1 rounded' : (isHoliday || dow === 0) ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-600'
            }`}>
              {day}
            </span>
            {isClosure && <span className="text-[10px] bg-orange-400 text-white px-1.5 py-px rounded font-bold shrink-0 whitespace-nowrap">休館</span>}
            {holidayName && <span className="text-xs text-red-400 truncate min-w-0">{holidayName}</span>}
          </div>

          <div className="flex flex-col flex-1 min-h-0">
            {/* AM */}
            <div className="flex-1 px-0.5 py-0.5 overflow-hidden space-y-px">
              {amBookings.slice(0, 2).map((b, i) => {
                const colors = ROOM_COLORS[b.room] || { bg: 'bg-gray-100', bar: 'bg-gray-400' };
                return (
                  <div key={i} onClick={e => handleItemClick(e, b)} className="text-xs font-normal text-[var(--md-on-surface)] rounded flex items-center gap-1 px-0.5 py-px overflow-hidden hover:bg-gray-200 cursor-pointer transition-colors">
                    <span className={`${colors.bar} w-2 h-2 rounded-full shrink-0`} />
                    <span className="truncate">{b.title}</span>
                  </div>
                );
              })}
              {amBookings.length > 2 && (
                <div className="text-xs text-gray-400 pl-1">+{amBookings.length - 2}</div>
              )}
            </div>

            {/* PM */}
            <div className="flex-1 px-0.5 py-0.5 bg-gray-100 border-t border-[var(--md-outline)] overflow-hidden space-y-px">
              {pmBookings.slice(0, 2).map((b, i) => {
                const colors = ROOM_COLORS[b.room] || { bg: 'bg-gray-100', bar: 'bg-gray-400' };
                return (
                  <div key={i} onClick={e => handleItemClick(e, b)} className="text-xs font-normal text-[var(--md-on-surface)] rounded flex items-center gap-1 px-0.5 py-px overflow-hidden hover:bg-gray-200 cursor-pointer transition-colors">
                    <span className={`${colors.bar} w-2 h-2 rounded-full shrink-0`} />
                    <span className="truncate">{b.title}</span>
                  </div>
                );
              })}
              {pmBookings.length > 2 && (
                <div className="text-xs text-gray-400 pl-1">+{pmBookings.length - 2}</div>
              )}
            </div>
          </div>
        </div>,
      );
    }

    return days;
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header with month nav + sub-view toggle */}
        <div className="flex items-center justify-between p-4 bg-white border-b border-[var(--md-outline)]">
          <div className="flex items-center gap-2">
            <h2 className="text-[22px] font-normal text-[var(--md-on-surface)]">
              {year}年 {month + 1}月
            </h2>
            <div className="flex gap-1">
              <button onClick={onPrevMonth} className="p-2 hover:bg-[var(--md-surface-1)] rounded-full transition-colors">
                <ChevronLeft size={20} className="text-[var(--md-on-surface-variant)]" />
              </button>
              <button onClick={onNextMonth} className="p-2 hover:bg-[var(--md-surface-1)] rounded-full transition-colors">
                <ChevronRight size={20} className="text-[var(--md-on-surface-variant)]" />
              </button>
            </div>
          </div>

          {/* Month / Week toggle */}
          <div className="flex items-center bg-gray-100 rounded-full p-0.5">
            <button
              onClick={() => setSubView('month')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                subView === 'month' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              月
            </button>
            <button
              onClick={() => setSubView('week')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                subView === 'week' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              週
            </button>
          </div>
        </div>

        {loading && (
          <div className="h-1 bg-emerald-100 overflow-hidden"><div className="h-full w-1/3 bg-emerald-400 animate-pulse rounded" /></div>
        )}

        {subView === 'month' ? (
          <>
            {/* Weekday header */}
            <div className="grid grid-cols-7 text-center bg-gray-50 border-b border-gray-200">
              {weekDays.map((d, i) => (
                <div key={d} className={`py-2 text-sm font-bold ${i === 6 ? 'text-red-500' : i === 5 ? 'text-blue-500' : 'text-gray-600'}`}>
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {generateCalendarDays()}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 p-3 border-t border-gray-100 text-xs text-gray-500 items-center">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-white border border-gray-200 rounded" />午前</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-gray-100 rounded" />午後</span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-yellow-400 rounded-full" />会議室</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-sky-400 rounded-full" />和室</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-pink-400 rounded-full" />図書室</span>
            </div>
          </>
        ) : (
          <div className="p-4">
            <CalendarWeeklyView
              weekStart={weekStart}
              bookings={bookings}
              onPrevWeek={() => setWeekStart(prev => {
                const d = new Date(prev);
                d.setDate(d.getDate() - 7);
                return d;
              })}
              onNextWeek={() => setWeekStart(prev => {
                const d = new Date(prev);
                d.setDate(d.getDate() + 7);
                return d;
              })}
              holidays={holidays}
            />
          </div>
        )}
      </div>

      {/* Day detail popover */}
      {modalDate && (
        <DayDetailPopover
          date={modalDate}
          bookings={bookings}
          anchorRect={modalAnchor}
          onClose={() => { setModalDate(null); setModalAnchor(null); }}
        />
      )}
    </>
  );
};

export default Calendar;
