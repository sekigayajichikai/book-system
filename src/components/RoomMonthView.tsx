import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Booking } from '../types';
import { ROOMS, TIME_SLOTS } from '../constants';

interface RoomMonthViewProps {
  room: typeof ROOMS[0];
  bookings: Booking[];
  year: number;
  month: number; // 0-indexed
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onBookingClick: (booking: Booking) => void;
  onSlotClick: (date: Date, slot: typeof TIME_SLOTS[0]) => void;
}

const DOW = ['月', '火', '水', '木', '金', '土', '日'];

const ROOM_COLORS: Record<string, { light: string; booked: string; text: string }> = {
  '会議室':       { light: 'bg-yellow-50',  booked: 'bg-yellow-100', text: 'text-yellow-800' },
  '和室（畳側）':  { light: 'bg-sky-50',     booked: 'bg-sky-100',    text: 'text-sky-800' },
  '和室（椅子側）': { light: 'bg-sky-50',     booked: 'bg-sky-100',    text: 'text-sky-800' },
  '図書室':       { light: 'bg-pink-50',    booked: 'bg-pink-100',   text: 'text-pink-800' },
};

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

const RoomMonthView: React.FC<RoomMonthViewProps> = ({
  room, bookings, year, month, onPrevMonth, onNextMonth, onBookingClick, onSlotClick,
}) => {
  const colors = ROOM_COLORS[room.name] || { light: 'bg-gray-50', booked: 'bg-gray-100', text: 'text-gray-700' };
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();

  const getBooking = (day: number, startTime: string): Booking | undefined => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return bookings.find(b => b.date === dateStr && b.startTime === startTime);
  };

  // カレンダーのセルを生成（6週分最大）
  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = [];

  const mondayOffset = firstDow === 0 ? 6 : firstDow - 1; // 月曜始まり
  for (let i = 0; i < mondayOffset; i++) currentWeek.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return (
    <div>
      {/* 月ナビ */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={onPrevMonth} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronLeft size={20} />
        </button>
        <span className="font-bold text-lg text-gray-700">
          {year}年{month + 1}月
        </span>
        <button onClick={onNextMonth} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* グリッド */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {DOW.map((d, i) => (
            <div key={d} className={`py-1.5 text-center text-xs font-bold ${
              i === 6 ? 'text-red-500' : i === 5 ? 'text-blue-500' : 'text-gray-500'
            }`}>
              {d}
            </div>
          ))}
        </div>

        {/* 週ごとの行 */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
            {week.map((day, di) => {
              if (day === null) {
                return <div key={`empty-${wi}-${di}`} className="bg-gray-50 min-h-[5rem]" />;
              }

              const date = new Date(year, month, day);
              const dow = date.getDay();
              const today = isToday(date);

              return (
                <div
                  key={day}
                  className={`min-h-[5rem] border-r border-gray-100 last:border-r-0 p-0.5 ${
                    today ? 'ring-2 ring-inset ring-emerald-400' : ''
                  }`}
                >
                  {/* 日付 */}
                  <div className={`text-xs font-bold px-1 ${
                    dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-600'
                  }`}>
                    {day}
                  </div>

                  {/* 午前/午後/夜間 */}
                  <div className="space-y-0.5 mt-0.5">
                    {TIME_SLOTS.map(slot => {
                      const booking = getBooking(day, slot.startTime);
                      if (booking) {
                        return (
                          <button
                            key={slot.id}
                            onClick={() => onBookingClick(booking)}
                            className={`w-full ${colors.booked} rounded px-1 py-0.5 text-left hover:opacity-80 transition-all`}
                          >
                            <span className={`${colors.text} text-[9px] font-bold leading-tight line-clamp-1`}>
                              {booking.title}
                            </span>
                          </button>
                        );
                      }
                      return (
                        <button
                          key={slot.id}
                          onClick={() => onSlotClick(date, slot)}
                          className={`w-full ${colors.light} rounded px-1 py-0.5 text-center hover:opacity-70 transition-all group`}
                        >
                          <span className="text-[9px] text-gray-300 group-hover:text-emerald-500">
                            {slot.gasKey}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RoomMonthView;
