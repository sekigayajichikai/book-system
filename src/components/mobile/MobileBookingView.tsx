import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Booking, RoomType } from '../../types';
import { ROOMS, TIME_SLOTS } from '../../constants';
import { useSwipe } from '../../hooks/useSwipe';

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

const ROOM_DOT: Record<string, string> = {
  '会議室':       'bg-yellow-400',
  '和室（畳側）':  'bg-sky-400',
  '和室（椅子側）': 'bg-sky-400',
  '図書室':       'bg-pink-400',
};

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatShort(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}(${DOW[d.getDay()]})`;
}

interface MobileBookingViewProps {
  weekStart: Date;
  bookings: Booking[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  filterRoom: RoomType | null;
  readOnly?: boolean;
}

export default function MobileBookingView({
  weekStart, bookings, onPrevWeek, onNextWeek, filterRoom,
}: MobileBookingViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useSwipe(containerRef, { onSwipeLeft: onNextWeek, onSwipeRight: onPrevWeek });

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const weekEnd = days[6];
  const rooms = filterRoom ? ROOMS.filter(r => r.id === filterRoom) : ROOMS;

  return (
    <div ref={containerRef} className="space-y-3">
      {/* Week navigation */}
      <div className="flex items-center justify-between px-1">
        <button onClick={onPrevWeek} className="p-2 rounded-full hover:bg-gray-100 active:scale-90 transition-transform">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <span className="text-base font-bold text-gray-700 tracking-wide">
          {formatShort(weekStart)} 〜 {formatShort(weekEnd)}
        </span>
        <button onClick={onNextWeek} className="p-2 rounded-full hover:bg-gray-100 active:scale-90 transition-transform">
          <ChevronRight size={20} className="text-gray-500" />
        </button>
      </div>

      {/* 凡例 */}
      <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" />会議室</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400" />和室</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-400" />図書室</span>
      </div>

      {/* Day blocks */}
      {days.map(date => {
        const today = isToday(date);
        const dateStr = formatDate(date);
        const dow = date.getDay();
        const dayBookings = bookings.filter(b => b.date === dateStr);

        return (
          <div
            key={dateStr}
            className={`rounded-xl border ${today ? 'border-blue-400 bg-blue-50/50 ring-2 ring-blue-200' : 'border-gray-200 bg-white'}`}
          >
            {/* Date header */}
            <div className="flex items-baseline gap-2 px-4 py-2.5 border-b border-gray-100">
              <span className={`text-lg font-bold ${today ? 'text-blue-600' : dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-800'}`}>
                {date.getMonth() + 1}/{date.getDate()}
              </span>
              <span className={`text-sm ${today ? 'text-blue-500' : dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                ({DOW[dow]})
              </span>
              {today && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-bold">TODAY</span>}
            </div>

            {/* Time slots */}
            <div className="px-3 py-2 space-y-2">
              {TIME_SLOTS.map(slot => {
                const slotBookings = dayBookings.filter(b => b.startTime === slot.startTime);

                return (
                  <div key={slot.id}>
                    <div className="text-gray-600 mb-1">
                      <span className="text-sm font-bold">{slot.gasKey}</span> <span className="text-xs">{slot.startTime}〜{slot.endTime}</span>
                    </div>
                    <div className="space-y-0.5">
                      {rooms.map(room => {
                        const booking = slotBookings.find(b => b.room === room.id);
                        return (
                          <div key={room.id} className="flex items-center gap-2 py-0.5 pl-2">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${ROOM_DOT[room.id] || 'bg-gray-300'}`} />
                            <span className="text-xs text-gray-600 w-16 shrink-0 truncate">
                              {room.name.replace('（畳側）', '(畳)').replace('（椅子側）', '(椅子)')}
                            </span>
                            {booking ? (
                              <span className="text-sm text-gray-800 truncate">{booking.title}</span>
                            ) : (
                              <span className="text-sm text-gray-200">─</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
