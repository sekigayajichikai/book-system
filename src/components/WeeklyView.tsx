import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, ChevronUp } from 'lucide-react';
import { ROOMS, TIME_SLOTS } from '../constants';
import { Booking, RoomType } from '../types';

interface WeeklyViewProps {
  weekStart: Date;
  bookings: Booking[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onSlotClick: (date: Date, room: RoomType, slotId: string, startTime: string, endTime: string) => void;
  onBookingClick?: (booking: Booking) => void;
  filterRoom?: RoomType | null;
}

const DOW_NAMES: Record<number, string> = { 0: '日', 1: '月', 2: '火', 3: '水', 4: '木', 5: '金', 6: '土' };

function getWeekDates(start: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

const SLOT_LABEL_COLOR = 'bg-gray-100';

const ROOM_COLORS: Record<string, { bg: string; bgBooked: string; text: string; bar: string }> = {
  '会議室':       { bg: 'bg-[var(--room-kaigi)]',  bgBooked: 'bg-[var(--room-kaigi-strong)]', text: 'text-[var(--md-on-surface)]', bar: 'bg-yellow-400' },
  '和室（畳側）':  { bg: 'bg-[var(--room-washi)]',  bgBooked: 'bg-[var(--room-washi-strong)]', text: 'text-[var(--md-on-surface)]', bar: 'bg-sky-400' },
  '和室（椅子側）': { bg: 'bg-[var(--room-washi)]',  bgBooked: 'bg-[var(--room-washi-strong)]', text: 'text-[var(--md-on-surface)]', bar: 'bg-sky-400' },
  '図書室':       { bg: 'bg-[var(--room-tosho)]',  bgBooked: 'bg-[var(--room-tosho-strong)]', text: 'text-[var(--md-on-surface)]', bar: 'bg-pink-400' },
};

const WeeklyView: React.FC<WeeklyViewProps> = ({
  weekStart, bookings, onPrevWeek, onNextWeek, onSlotClick, onBookingClick, filterRoom,
}) => {
  const weekDates = getWeekDates(weekStart);
  const displayRooms = filterRoom ? ROOMS.filter(r => r.id === filterRoom) : ROOMS;

  // 夜間の折りたたみ状態。夜間に予約がある週は自動展開
  const nightSlot = TIME_SLOTS.find(s => s.gasKey === '夜間');
  const hasNightBooking = nightSlot && weekDates.some(date => {
    const dateStr = formatDate(date);
    return bookings.some(b => b.date === dateStr && b.startTime === nightSlot.startTime);
  });
  const [showNight, setShowNight] = useState(!!hasNightBooking);

  const daySlots = TIME_SLOTS.filter(s => s.gasKey !== '夜間');

  const getBooking = (date: Date, room: RoomType, startTime: string): Booking | undefined => {
    const dateStr = formatDate(date);
    return bookings.find(b => b.date === dateStr && b.room === room && b.startTime === startTime);
  };

  return (
    <div className="space-y-4">
      {/* 週ナビ */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
        <button onClick={onPrevWeek} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div className="text-center">
          <span className="font-bold text-xl text-gray-800">
            {weekDates[0].getFullYear()}年{weekDates[0].getMonth() + 1}月
          </span>
          <span className="text-gray-500 ml-2">
            {weekDates[0].getDate()}日 〜 {weekDates[6].getMonth() + 1}月{weekDates[6].getDate()}日
          </span>
        </div>
        <button onClick={onNextWeek} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronRight size={24} />
        </button>
      </div>

      {/* 曜日ヘッダー */}
      <div className="grid grid-cols-8 gap-1">
        <div /> {/* 左上の空セル */}
        {weekDates.map(date => {
          const dow = date.getDay();
          const today = isToday(date);
          return (
            <div
              key={date.toISOString()}
              className={`text-center py-1.5 rounded-lg ${today ? 'bg-emerald-600 text-white' : ''}`}
            >
              <div className={`text-[11px] font-medium ${
                today ? 'text-emerald-100' : dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-[var(--md-on-surface-variant)]'
              }`}>
                {DOW_NAMES[dow]}
              </div>
              <div className={`text-sm font-medium ${
                today ? 'text-white' : 'text-[var(--md-on-surface)]'
              }`}>
                {date.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* 午前・午後ブロック */}
      {daySlots.map(slot => (
        <div key={slot.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className={`${SLOT_LABEL_COLOR} px-4 py-1.5 flex items-center gap-3 border-b border-[var(--md-outline)]`}>
            <span className="font-medium text-sm text-[var(--md-on-surface)]">{slot.gasKey}</span>
            <span className="text-[11px] text-[var(--md-on-surface-variant)]">{slot.startTime} 〜 {slot.endTime}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {displayRooms.map(room => {
              const roomColor = ROOM_COLORS[room.name] || { bg: 'bg-gray-100', bgBooked: 'bg-gray-100', text: 'text-gray-700' };
              return (
                <div key={`${slot.id}-${room.id}`} className="grid grid-cols-8 gap-1 p-1">
                  <div className={`flex items-center justify-center rounded-lg ${roomColor.bgBooked}`}>
                    <span className="text-[12px] font-medium text-[var(--md-on-surface)] px-2 py-1 whitespace-nowrap">
                      {room.name.replace('（畳側）', '(畳)').replace('（椅子側）', '(椅子)')}
                    </span>
                  </div>
                  {weekDates.map(date => {
                    const booking = getBooking(date, room.id, slot.startTime);
                    if (booking) {
                      return (
                        <button key={`${date.toISOString()}-${room.id}`} onClick={() => onBookingClick?.(booking)}
                          className={`${roomColor.bgBooked} rounded min-h-[2.75rem] flex items-center justify-center text-center hover:opacity-80 px-1.5 py-0.5`}>
                          <span className="text-[12px] font-normal text-[var(--md-on-surface)] leading-tight line-clamp-2">{booking.title}</span>
                        </button>
                      );
                    }
                    return (
                      <button key={`${date.toISOString()}-${room.id}`} onClick={() => onSlotClick(date, room.id, slot.id, slot.startTime, slot.endTime)}
                        className="rounded min-h-[2.75rem] flex items-center justify-center hover:bg-[var(--md-surface-1)] transition-colors group border border-transparent hover:border-[var(--md-outline)]">
                        <span className="text-[var(--md-outline)] group-hover:text-blue-500 text-sm">◎</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* 夜間: 折りたたみ */}
      {nightSlot && (
        <>
          <button
            onClick={() => setShowNight(!showNight)}
            className="w-full bg-white rounded-2xl shadow-sm border border-gray-200 px-4 py-2 flex items-center gap-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all"
          >
            {showNight ? <ChevronUp size={16} /> : <Plus size={16} />}
            <span className="text-sm font-bold">夜間 {nightSlot.startTime}〜{nightSlot.endTime}</span>
            {hasNightBooking && !showNight && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">予約あり</span>
            )}
          </button>

          {showNight && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {/* 夜間は会議室のみ（データ上他の部屋の利用はゼロ） */}
                {displayRooms.slice(0, 1).map(room => {
                  const roomColor = ROOM_COLORS[room.name] || { bg: 'bg-gray-100', bgBooked: 'bg-gray-100', text: 'text-gray-700' };
                  return (
                    <div key={`night-${room.id}`} className="grid grid-cols-8 gap-1 p-1">
                      <div className={`flex items-center justify-center rounded-lg ${roomColor.bgBooked}`}>
                        <span className={`text-sm font-bold ${roomColor.text} px-2 py-1 whitespace-nowrap`}>
                          {room.name.replace('（畳側）', '(畳)').replace('（椅子側）', '(椅子)')}
                        </span>
                      </div>
                      {weekDates.map(date => {
                        const booking = getBooking(date, room.id, nightSlot.startTime);
                        if (booking) {
                          return (
                            <button key={`${date.toISOString()}-night`} onClick={() => onBookingClick?.(booking)}
                              className={`${roomColor.bgBooked} rounded-lg p-1.5 min-h-[3rem] flex items-center justify-center text-center hover:opacity-80`}>
                              <span className={`${roomColor.text} text-xs font-bold leading-tight line-clamp-2`}>{booking.title}</span>
                            </button>
                          );
                        }
                        return (
                          <button key={`${date.toISOString()}-night`} onClick={() => onSlotClick(date, room.id, nightSlot.id, nightSlot.startTime, nightSlot.endTime)}
                            className={`${roomColor.bg} rounded-lg min-h-[3rem] flex items-center justify-center hover:opacity-80 group`}>
                            <span className="text-gray-300 group-hover:text-emerald-500 text-lg font-bold">◎</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default WeeklyView;
