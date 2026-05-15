import { Booking } from '../../types';
import { TIME_SLOTS } from '../../constants';

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

const ROOM_DOT: Record<string, string> = {
  '会議室':       'bg-yellow-400',
  '和室（畳側）':  'bg-sky-400',
  '和室（椅子側）': 'bg-sky-400',
  '図書室':       'bg-pink-400',
};

interface MobileDayCardProps {
  date: Date;
  bookings: Booking[];
  isToday?: boolean;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function MobileDayCard({ date, bookings, isToday }: MobileDayCardProps) {
  const dow = date.getDay();
  const dateStr = formatDate(date);
  const dayBookings = bookings.filter(b => b.date === dateStr);

  const slotGroups = TIME_SLOTS.map(slot => ({
    slot,
    items: dayBookings.filter(b => b.startTime === slot.startTime),
  })).filter(g => g.items.length > 0);

  return (
    <div className={`rounded-xl border ${isToday ? 'border-blue-400 bg-blue-50/50 ring-2 ring-blue-200' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className={`text-lg font-bold ${isToday ? 'text-blue-600' : dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-800'}`}>
            {date.getMonth() + 1}/{date.getDate()}
          </span>
          <span className={`text-sm ${isToday ? 'text-blue-500' : dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
            ({DOW[dow]})
          </span>
          {isToday && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-bold">TODAY</span>}
        </div>
      </div>

      {slotGroups.length === 0 ? (
        <div className="px-4 pb-3 text-sm text-gray-300">予定なし</div>
      ) : (
        <div className="px-4 pb-3 space-y-2">
          {slotGroups.map(({ slot, items }) => (
            <div key={slot.id}>
              <div className="text-gray-600 mb-0.5"><span className="text-sm font-bold">{slot.gasKey}</span> <span className="text-xs">{slot.startTime}〜{slot.endTime}</span></div>
              {items.map(b => (
                <div key={b.id} className="flex items-center gap-2 py-0.5">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ROOM_DOT[b.room] || 'bg-gray-300'}`} />
                  <span className="text-sm text-gray-800 truncate">{b.title}</span>
                  <span className="text-xs text-gray-500 shrink-0">{String(b.room).replace('（畳側）', '(畳)').replace('（椅子側）', '(椅子)')}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
