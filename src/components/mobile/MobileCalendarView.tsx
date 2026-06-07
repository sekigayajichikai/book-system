import { useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Booking } from '../../types';
import { useSwipe } from '../../hooks/useSwipe';
import MobileDayCard from './MobileDayCard';

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface MobileCalendarViewProps {
  currentDate: Date;
  bookings: Booking[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  holidays?: Record<string, string>;
  closures?: Set<string>;
  loading?: boolean;
}

export default function MobileCalendarView({
  currentDate, bookings, onPrevMonth, onNextMonth, holidays = {}, closures = new Set(), loading,
}: MobileCalendarViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);

  useSwipe(containerRef, { onSwipeLeft: onNextMonth, onSwipeRight: onPrevMonth });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Scroll to today on first render
  useEffect(() => {
    todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Build all days in the month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: Date[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  return (
    <div ref={containerRef} className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-1">
        <button onClick={onPrevMonth} className="p-2 rounded-full hover:bg-gray-100 active:scale-90 transition-transform">
          <ChevronLeft size={40} className="text-gray-500" />
        </button>
        <span className="text-xl font-bold text-gray-700 tracking-wide">
          {year}年 {month + 1}月
        </span>
        <button onClick={onNextMonth} className="p-2 rounded-full hover:bg-gray-100 active:scale-90 transition-transform">
          <ChevronRight size={40} className="text-gray-500" />
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
        const dateStr = formatDate(date);
        return (
          <div key={dateStr} ref={today ? todayRef : undefined}>
            <MobileDayCard
              date={date}
              bookings={bookings}
              isToday={today}
              holidayName={holidays[dateStr]}
              isClosure={closures.has(dateStr)}
            />
          </div>
        );
      })}
    </div>
  );
}
