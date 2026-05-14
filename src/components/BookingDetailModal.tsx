import { X, Calendar, Clock, MapPin, User, FileText } from 'lucide-react';
import { Booking } from '../types';
import { ROOMS } from '../constants';

interface BookingDetailModalProps {
  booking: Booking;
  onClose: () => void;
}

const ROOM_COLORS: Record<string, string> = {
  '会議室':       'bg-yellow-100 text-yellow-900 border-yellow-200',
  '和室（畳側）':  'bg-sky-100 text-sky-900 border-sky-200',
  '和室（椅子側）': 'bg-sky-100 text-sky-900 border-sky-200',
  '図書室':       'bg-pink-100 text-pink-900 border-pink-200',
};

const SLOT_LABELS: Record<string, string> = {
  '09:00': '午前',
  '13:00': '午後',
  '17:00': '夜間',
};

const BookingDetailModal: React.FC<BookingDetailModalProps> = ({ booking, onClose }) => {
  const room = ROOMS.find(r => r.id === booking.room);
  const colorClass = ROOM_COLORS[room?.name || ''] || 'bg-gray-100 text-gray-700 border-gray-200';
  const slotLabel = SLOT_LABELS[booking.startTime] || '';

  // タイトルから団体名とメモを分離（「団体名「メモ」」形式）
  const titleMatch = booking.title.match(/^(.+?)「(.+?)」$/);
  const orgName = titleMatch ? titleMatch[1] : booking.title;
  const memo = titleMatch ? titleMatch[2] : '';

  const dateParts = booking.date.split('-');
  const dateDisplay = `${dateParts[0]}年${parseInt(dateParts[1])}月${parseInt(dateParts[2])}日`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className={`${colorClass} border-b p-5 flex justify-between items-start`}>
          <div>
            <h2 className="text-xl font-bold">{orgName}</h2>
            {memo && <p className="text-sm mt-1 opacity-80">「{memo}」</p>}
          </div>
          <button onClick={onClose} className="p-1 hover:opacity-60 transition-opacity">
            <X size={22} />
          </button>
        </div>

        {/* 詳細 */}
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-gray-400 shrink-0" />
            <div>
              <div className="text-sm text-gray-500">日付</div>
              <div className="font-bold text-gray-800">{dateDisplay}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock size={18} className="text-gray-400 shrink-0" />
            <div>
              <div className="text-sm text-gray-500">時間帯</div>
              <div className="font-bold text-gray-800">{slotLabel} {booking.startTime} 〜 {booking.endTime}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <MapPin size={18} className="text-gray-400 shrink-0" />
            <div>
              <div className="text-sm text-gray-500">部屋</div>
              <div className="font-bold text-gray-800">{room?.name}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <User size={18} className="text-gray-400 shrink-0" />
            <div>
              <div className="text-sm text-gray-500">団体名</div>
              <div className="font-bold text-gray-800">{orgName}</div>
            </div>
          </div>

          {memo && (
            <div className="flex items-start gap-3">
              <FileText size={18} className="text-gray-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm text-gray-500">活動内容・備考</div>
                <div className="font-bold text-gray-800">{memo}</div>
              </div>
            </div>
          )}
        </div>

        {/* アクション */}
        <div className="border-t border-gray-100 p-4 flex gap-3">
          <button className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors">
            編集
          </button>
          <button className="flex-1 px-4 py-2.5 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors">
            キャンセル
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-500 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingDetailModal;
