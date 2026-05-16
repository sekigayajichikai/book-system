import { useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Booking } from '../../types';
import { useSwipe } from '../../hooks/useSwipe';
import MobileDayCard from './MobileDayCard';

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

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

interface MobileCalendarViewProps {
  weekStart: Date;
  bookings: Booking[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  holidays?: Record<string, string>;
  closures?: Set<string>;
  loading?: boolean;
}

export default function MobileCalendarView({
  weekStart, bookings, onPrevWeek, onNextWeek, holidays = {}, closures = new Set(), loading,
}: MobileCalendarViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);

  useSwipe(containerRef, { onSwipeLeft: onNextWeek, onSwipeRight: onPrevWeek });

  // Scroll to today on first render
  useEffect(() => {
    todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const weekEnd = days[6];

  return (
    <div ref={containerRef} className="space-y-3">
      {/* Week navigation */}
      <div className="flex items-center justify-between px-1">
        <button onClick={onPrevWeek} className="p-2 rounded-full hover:bg-gray-100 active:scale-90 transition-transform">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <span className="text-lg font-bold text-gray-700 tracking-wide">
          {formatShort(weekStart)} 〜 {formatShort(weekEnd)}
        </span>
        <button onClick={onNextWeek} className="p-2 rounded-full hover:bg-gray-100 active:scale-90 transition-transform">
          <ChevronRight size={20} className="text-gray-500" />
        </button>
      </div>

      {/* 凡例 */}
      <div className="flex items-center justify-center gap-5 text-base text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />会議室</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-400" />和室</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pink-400" />図書室</span>
      </div>

      {loading && <div className="text-center text-sm text-gray-400 py-4">読み込み中...</div>}

      {/* Day cards */}
      {days.map(date => {
        const today = isToday(date);
        return (
          <div key={date.toISOString()} ref={today ? todayRef : undefined}>
            <MobileDayCard
              date={date}
              bookings={bookings}
              isToday={today}
              holidayName={holidays[formatDate(date)]}
              isClosure={closures.has(formatDate(date))}
            />
          </div>
        );
      })}
    </div>
  );
}
