import { X } from 'lucide-react';
import { ROOMS, TIME_SLOTS } from '../constants';
import { Booking, RoomType } from '../types';

interface DailyScheduleGridProps {
  date: Date;
  bookings: Booking[];
  onClose: () => void;
  onSelectSlot: (room: RoomType, slotId: string, startTime: string, endTime: string) => void;
}

const ROOM_COLORS: Record<string, { bg: string; bgBooked: string; text: string; header: string }> = {
  '会議室':       { bg: 'bg-yellow-50',  bgBooked: 'bg-yellow-100', text: 'text-yellow-900', header: 'bg-yellow-200 text-yellow-900' },
  '和室（畳側）':  { bg: 'bg-sky-50',     bgBooked: 'bg-sky-100',    text: 'text-sky-900',    header: 'bg-sky-200 text-sky-900' },
  '和室（椅子側）': { bg: 'bg-sky-50',     bgBooked: 'bg-sky-100',    text: 'text-sky-900',    header: 'bg-sky-200 text-sky-900' },
  '図書室':       { bg: 'bg-pink-50',    bgBooked: 'bg-pink-100',   text: 'text-pink-900',   header: 'bg-pink-200 text-pink-900' },
};

const DailyScheduleGrid: React.FC<DailyScheduleGridProps> = ({ date, bookings, onClose, onSelectSlot }) => {
  const getBookingForSlot = (room: RoomType, startTime: string) => {
    return bookings.find(b => b.room === room && b.startTime === startTime);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-2 md:p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-800">
              {date.getFullYear()}年{date.getMonth() + 1}月{date.getDate()}日 の予約状況
            </h2>
            <p className="text-sm text-gray-500 mt-1">希望の時間枠をクリックして予約してください</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        {/* Grid Area */}
        <div className="flex-1 overflow-auto p-4">
          <div className="min-w-[600px]">
            {/* Table Header */}
            <div className="grid grid-cols-5 gap-2 mb-2">
              <div className="flex items-center justify-center font-bold text-gray-400 text-sm">
                時間 / 部屋
              </div>
              {ROOMS.map(room => {
                const colors = ROOM_COLORS[room.name] || { header: 'bg-gray-200 text-gray-700' };
                return (
                  <div key={room.id} className={`${colors.header} p-3 rounded-lg text-center`}>
                    <div className="font-bold text-sm md:text-base">{room.name.replace('（畳側）', '(畳)').replace('（椅子側）', '(椅子)')}</div>
                    <div className="text-[10px] md:text-xs opacity-70 mt-1">{room.capacity}名</div>
                  </div>
                );
              })}
            </div>

            {/* Table Body */}
            <div className="space-y-2">
              {TIME_SLOTS.map(slot => (
                <div key={slot.id} className="grid grid-cols-5 gap-2 h-28">
                  {/* Time Column */}
                  <div className="bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-600 border border-gray-200">
                    <span className="font-bold text-base text-gray-700">{slot.gasKey}</span>
                    <span className="text-xs text-gray-400">{slot.startTime}〜{slot.endTime}</span>
                  </div>

                  {/* Room Columns */}
                  {ROOMS.map(room => {
                    const booking = getBookingForSlot(room.id, slot.startTime);
                    const colors = ROOM_COLORS[room.name] || { bg: 'bg-gray-50', bgBooked: 'bg-gray-100', text: 'text-gray-700' };

                    if (booking) {
                      return (
                        <div key={`${room.id}-${slot.id}`} className={`${colors.bgBooked} rounded-lg p-2 flex flex-col justify-center items-center text-center overflow-hidden`}>
                          <div className={`${colors.text} font-bold text-sm line-clamp-2`}>{booking.title}</div>
                        </div>
                      );
                    }
                    return (
                      <button
                        key={`${room.id}-${slot.id}`}
                        onClick={() => onSelectSlot(room.id, slot.id, slot.startTime, slot.endTime)}
                        className={`${colors.bg} rounded-lg p-2 flex flex-col justify-center items-center text-center hover:opacity-80 transition-all group cursor-pointer`}
                      >
                        <span className="text-gray-300 group-hover:text-emerald-500 text-2xl font-bold">◎</span>
                        <span className="text-xs text-gray-400 group-hover:text-emerald-600 font-bold">空き</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-3 text-xs text-gray-500 border-t border-gray-200 text-center">
          部屋と時間の交差する「◎」をクリックすると予約画面に進みます。
        </div>
      </div>
    </div>
  );
};

export default DailyScheduleGrid;
