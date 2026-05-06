import React from 'react';
import { X, CheckCircle } from 'lucide-react';
import { ROOMS, TIME_SLOTS } from '../constants';
import { Booking, RoomType } from '../types';

interface DailyScheduleGridProps {
  date: Date;
  bookings: Booking[];
  onClose: () => void;
  onSelectSlot: (room: RoomType, slotId: string, startTime: string, endTime: string) => void;
}

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
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
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
              {ROOMS.map(room => (
                <div key={room.id} className="bg-emerald-600 text-white p-3 rounded-lg text-center shadow-sm">
                  <div className="font-bold text-sm md:text-base">{room.name}</div>
                  <div className="text-[10px] md:text-xs opacity-90 mt-1">{room.capacity}名</div>
                </div>
              ))}
            </div>

            {/* Table Body */}
            <div className="space-y-2">
              {TIME_SLOTS.map(slot => (
                <div key={slot.id} className="grid grid-cols-5 gap-2 h-32">
                  {/* Time Column */}
                  <div className="bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-600 border border-gray-200">
                    <span className="font-bold text-lg">{slot.startTime.split(':')[0]}:00</span>
                    <span className="text-xs">|</span>
                    <span className="font-bold text-lg">{slot.endTime.split(':')[0]}:00</span>
                  </div>

                  {/* Room Columns */}
                  {ROOMS.map(room => {
                    const booking = getBookingForSlot(room.id, slot.startTime);
                    
                    if (booking) {
                      return (
                        <div key={`${room.id}-${slot.id}`} className="bg-amber-100 border border-amber-200 rounded-lg p-2 flex flex-col justify-center items-center text-center relative overflow-hidden group">
                           <div className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full mb-1 font-bold">予約済</div>
                           <div className="font-bold text-amber-900 text-sm line-clamp-2">{booking.purpose}</div>
                           <div className="text-xs text-amber-700 mt-1">{booking.applicantName} 様</div>
                        </div>
                      );
                    } else {
                      return (
                        <button
                          key={`${room.id}-${slot.id}`}
                          onClick={() => onSelectSlot(room.id, slot.id, slot.startTime, slot.endTime)}
                          className="bg-white border-2 border-emerald-100 border-dashed rounded-lg p-2 flex flex-col justify-center items-center text-center hover:bg-emerald-50 hover:border-emerald-300 transition-all group cursor-pointer"
                        >
                          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-300 flex items-center justify-center mb-1 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                             <span className="text-2xl font-bold">○</span>
                          </div>
                          <span className="text-xs text-emerald-400 font-bold group-hover:text-emerald-600">空き</span>
                        </button>
                      );
                    }
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="bg-gray-50 p-4 text-xs text-gray-500 border-t border-gray-200 text-center">
           部屋と時間の交差する「○」をクリックすると予約画面に進みます。
        </div>
      </div>
    </div>
  );
};

export default DailyScheduleGrid;