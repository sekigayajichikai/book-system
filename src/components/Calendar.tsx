import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Booking } from '../types';
import { ROOMS, TIME_SLOTS } from '../constants';

interface CalendarProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  bookings: Booking[];
  onDateClick: (date: Date) => void;
  loading?: boolean;
}

const Calendar: React.FC<CalendarProps> = ({
  currentDate, onPrevMonth, onNextMonth, bookings, onDateClick, loading,
}) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  /** 1日あたりの最大スロット数（部屋数 × 時間帯数） */
  const maxSlots = ROOMS.length * TIME_SLOTS.length;

  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

  const generateCalendarDays = () => {
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-24 bg-gray-50 border border-gray-100" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayBookings = bookings.filter(b => b.date === dateStr);
      const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
      const count = dayBookings.length;

      let statusText = '空きあり';
      let statusClass = 'text-green-600 bg-green-50';
      if (count >= maxSlots) {
        statusText = '満室';
        statusClass = 'text-red-600 bg-red-50';
      } else if (count >= maxSlots * 0.5) {
        statusText = '混雑';
        statusClass = 'text-orange-600 bg-orange-50';
      }

      days.push(
        <div
          key={day}
          onClick={() => onDateClick(new Date(year, month, day))}
          className={`h-24 border border-gray-200 p-1 relative cursor-pointer hover:bg-blue-50 transition-colors ${isToday ? 'ring-2 ring-blue-400' : ''}`}
        >
          <div className="flex justify-between items-start">
            <span className={`text-sm font-medium h-6 w-6 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700'}`}>
              {day}
            </span>
          </div>
          <div className="mt-2">
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${statusClass}`}>
              {statusText}
            </span>
            {count > 0 && (
              <div className="mt-1 text-[10px] text-gray-500 truncate">
                {count}件の予約
              </div>
            )}
          </div>
        </div>,
      );
    }

    return days;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between p-4 bg-emerald-600 text-white">
        <h2 className="text-xl font-bold">
          {year}年 {month + 1}月
        </h2>
        <div className="flex gap-2">
          <button onClick={onPrevMonth} className="p-2 hover:bg-emerald-700 rounded-full transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button onClick={onNextMonth} className="p-2 hover:bg-emerald-700 rounded-full transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="p-4 text-center text-gray-500 text-sm">読み込み中...</div>
      )}

      <div className="grid grid-cols-7 text-center bg-gray-50 border-b border-gray-200">
        {weekDays.map((d, i) => (
          <div key={d} className={`py-2 text-sm font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-600'}`}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {generateCalendarDays()}
      </div>
    </div>
  );
};

export default Calendar;
