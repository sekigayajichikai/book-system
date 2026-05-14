import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ROOMS, TIME_SLOTS } from '../constants';
import { Booking, RoomType } from '../types';

interface RoomMonthWeeklyProps {
  bookings: Booking[];
  year: number;
  month: number; // 0-indexed
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSlotClick: (date: Date, room: RoomType, slotId: string, startTime: string, endTime: string) => void;
  onBookingClick?: (booking: Booking) => void;
  filterRoom: RoomType | null;
}

const DOW_NAMES: Record<number, string> = { 0: '日', 1: '月', 2: '火', 3: '水', 4: '木', 5: '金', 6: '土' };

// 午前・午後のみ（夜間カット）
const DAY_SLOTS = TIME_SLOTS.filter(s => s.gasKey !== '夜間');

const ROOM_COLORS: Record<string, { bg: string; bgBooked: string; text: string }> = {
  '会議室':       { bg: 'bg-yellow-50',  bgBooked: 'bg-yellow-100', text: 'text-yellow-900' },
  '和室（畳側）':  { bg: 'bg-sky-50',     bgBooked: 'bg-sky-100',    text: 'text-sky-900' },
  '和室（椅子側）': { bg: 'bg-sky-50',     bgBooked: 'bg-sky-100',    text: 'text-sky-900' },
  '図書室':       { bg: 'bg-pink-50',    bgBooked: 'bg-pink-100',   text: 'text-pink-900' },
};

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function getMonthWeeks(year: number, month: number): (Date | null)[][] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = [];

  const mondayOffset = firstDow === 0 ? 6 : firstDow - 1; // 月曜始まり
  for (let i = 0; i < mondayOffset; i++) week.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    week.push(new Date(year, month, day));
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

const RoomMonthWeekly: React.FC<RoomMonthWeeklyProps> = ({
  bookings, year, month, onPrevMonth, onNextMonth, onSlotClick, onBookingClick, filterRoom,
}) => {
  const weeks = getMonthWeeks(year, month);
  const displayRooms = filterRoom ? ROOMS.filter(r => r.id === filterRoom) : ROOMS;

  const getBooking = (date: Date, room: RoomType, startTime: string): Booking | undefined => {
    const dateStr = formatDate(date);
    return bookings.find(b => b.date === dateStr && b.room === room && b.startTime === startTime);
  };

  return (
    <div className="space-y-4">
      {/* 月ナビ */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex items-center justify-between">
        <button onClick={onPrevMonth} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={24} />
        </button>
        <span className="font-bold text-xl text-gray-800">
          {year}年{month + 1}月
        </span>
        <button onClick={onNextMonth} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronRight size={24} />
        </button>
      </div>

      {/* 週ごとに繰り返し */}
      {weeks.map((week, wi) => (
        <div key={wi}>
          {/* 曜日+日付ヘッダー */}
          <div className="grid grid-cols-8 gap-1 mb-1" style={{ marginLeft: 'calc(1.75rem + 0.25rem)' }}>
            <div />
            {week.map((date, di) => {
              if (!date) return <div key={`e-${di}`} />;
              const dow = date.getDay();
              const today = isToday(date);
              return (
                <div
                  key={date.toISOString()}
                  className={`text-center py-1.5 rounded-lg ${today ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200'}`}
                >
                  <div className={`text-[10px] font-medium ${
                    today ? 'text-blue-100' : dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-400'
                  }`}>
                    {DOW_NAMES[dow]}
                  </div>
                  <div className={`text-sm font-bold ${
                    today ? 'text-white' : dow === 0 ? 'text-red-600' : dow === 6 ? 'text-blue-600' : 'text-gray-800'
                  }`}>
                    {date.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 午前・午後ブロック */}
          {DAY_SLOTS.map((slot, si) => (
            <div key={`${wi}-${slot.id}`} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-1">
              <div className="flex">
                {/* 時間帯ラベル（縦書き） */}
                <div className="w-7 shrink-0 bg-gray-200 flex items-center justify-center rounded-l-xl">
                  <span className="text-xs font-bold text-gray-600" style={{ writingMode: 'vertical-rl' }}>
                    {slot.gasKey}
                  </span>
                </div>

                <div className="flex-1 divide-y divide-gray-100">
                {displayRooms.map(room => {
                  const roomColor = ROOM_COLORS[room.name] || { bg: 'bg-gray-50', bgBooked: 'bg-gray-100', text: 'text-gray-700' };
                  return (
                    <div key={`${slot.id}-${room.id}`} className="grid grid-cols-8 gap-1 p-0.5">
                      {/* 部屋名 */}
                      <div className={`flex items-center justify-center rounded-lg ${roomColor.bgBooked}`}>
                        <span className={`text-[10px] font-bold ${roomColor.text} whitespace-nowrap`}>
                          {room.name.replace('（畳側）', '(畳)').replace('（椅子側）', '(椅子)')}
                        </span>
                      </div>

                      {/* 7日分 */}
                      {week.map((date, di) => {
                        if (!date) {
                          return <div key={`e-${di}`} className="min-h-[2.5rem]" />;
                        }

                        const booking = getBooking(date, room.id, slot.startTime);
                        if (booking) {
                          return (
                            <button
                              key={date.toISOString()}
                              onClick={() => onBookingClick?.(booking)}
                              className={`${roomColor.bgBooked} rounded-lg p-1 min-h-[2.5rem] flex items-center justify-center text-center hover:opacity-80`}
                            >
                              <span className={`${roomColor.text} text-[10px] font-bold leading-tight line-clamp-2`}>
                                {booking.title}
                              </span>
                            </button>
                          );
                        }
                        return (
                          <button
                            key={date.toISOString()}
                            onClick={() => onSlotClick(date, room.id, slot.id, slot.startTime, slot.endTime)}
                            className={`${roomColor.bg} rounded-lg min-h-[2.5rem] flex items-center justify-center hover:opacity-80 group`}
                          >
                            <span className="text-gray-300 group-hover:text-emerald-500 text-sm font-bold">◎</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default RoomMonthWeekly;
