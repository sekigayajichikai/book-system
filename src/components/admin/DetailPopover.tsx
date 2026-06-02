import { Pencil, Trash2, X, Clock, MapPin, Users, AlignLeft, Star } from 'lucide-react';
import Popover from './Popover';

const ROOM_COLORS: Record<string, string> = {
  '会議室': 'bg-yellow-400',
  '和室（畳側）': 'bg-sky-400',
  '和室（椅子側）': 'bg-sky-400',
  '図書室': 'bg-pink-400',
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

async function supaFetch(path: string, options?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
      ...(options?.headers || {}),
    },
  });
}

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

export interface DetailData {
  type: 'event' | 'booking';
  id: string;
  title: string;
  date: string;
  // event fields
  location?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  memo?: string | null;
  description?: string | null;
  eventType?: string;
  isMajor?: boolean;
  // booking fields
  room?: string;
  slot?: string;
}

interface DetailPopoverProps {
  anchorRect: { top: number; left: number; width: number; height: number };
  data: DetailData;
  onClose: () => void;
  onEdit: (data: DetailData) => void;
  onRefresh: () => void;
}

export default function DetailPopover({ anchorRect, data, onClose, onEdit, onRefresh }: DetailPopoverProps) {
  const d = new Date(data.date + 'T00:00:00');
  const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日 (${DOW[d.getDay()]})`;

  const handleDelete = async () => {
    if (!confirm(`「${data.title}」を削除しますか？`)) return;

    if (data.type === 'event') {
      await supaFetch(`calendar_events?id=eq.${data.id}`, { method: 'DELETE' });
    } else {
      // booking: event_idを取得して孤立イベントも削除
      const evRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${data.id}&select=event_id`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      });
      const evData = evRes.ok ? await evRes.json() : [];
      const eventId = evData[0]?.event_id;

      await supaFetch(`bookings?id=eq.${data.id}`, { method: 'DELETE' });

      if (eventId) {
        const remRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?event_id=eq.${eventId}&status=in.(CONFIRMED,PENDING)&select=id&limit=1`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        });
        const remaining = remRes.ok ? await remRes.json() : [1];
        if (remaining.length === 0) {
          await supaFetch(`calendar_events?id=eq.${eventId}`, { method: 'DELETE' });
        }
      }
    }
    onClose();
    onRefresh();
  };

  // 時間表示
  let timeLabel = '';
  if (data.type === 'booking' && data.slot) {
    timeLabel = data.slot;
    if (data.startTime) timeLabel += ` ${data.startTime}`;
    if (data.endTime) timeLabel += `〜${data.endTime}`;
  } else if (data.startTime) {
    timeLabel = data.startTime;
    if (data.endTime) timeLabel += `〜${data.endTime}`;
  }

  // 場所/部屋
  const locationLabel = data.type === 'booking' ? data.room : data.location;

  return (
    <Popover anchorRect={anchorRect} onClose={onClose} width={340}>
      {/* ヘッダーアクション */}
      <div className="flex items-center justify-end gap-1 px-3 pt-3 pb-1">
        <button onClick={() => onEdit(data)} className="p-1.5 hover:bg-gray-100 rounded-full" title="編集">
          <Pencil size={16} className="text-gray-500" />
        </button>
        <button onClick={handleDelete} className="p-1.5 hover:bg-gray-100 rounded-full" title="削除">
          <Trash2 size={16} className="text-gray-500" />
        </button>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full" title="閉じる">
          <X size={16} className="text-gray-500" />
        </button>
      </div>

      {/* 本文 */}
      <div className="px-4 pb-4 space-y-3">
        {/* タイトル */}
        <div className="flex items-start gap-3">
          <div className={`w-3 h-3 rounded-sm mt-1.5 flex-shrink-0 ${
            data.type === 'booking' && data.room ? (ROOM_COLORS[data.room] || 'bg-gray-400') : 'bg-blue-500'
          }`} />
          <div>
            <h3 className="text-lg font-medium text-gray-900 leading-tight">{data.title}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{dateLabel}</p>
          </div>
        </div>

        {/* 時間 */}
        {timeLabel && (
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Clock size={16} className="text-gray-400 flex-shrink-0" />
            <span>{timeLabel}</span>
          </div>
        )}

        {/* 場所/部屋 */}
        {locationLabel && (
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <MapPin size={16} className="text-gray-400 flex-shrink-0" />
            <span>{locationLabel}</span>
          </div>
        )}

        {/* 説明/メモ */}
        {(data.memo || data.description) && (
          <div className="flex items-start gap-3 text-sm text-gray-600">
            <AlignLeft size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
            <span>{data.description || data.memo}</span>
          </div>
        )}

        {/* タイプバッジ（イベントのみ表示） */}
        {(data.type === 'event' || data.isMajor) && (
          <div className="flex items-center gap-2 pt-1">
            {data.type === 'event' && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                data.eventType === 'facility'
                  ? 'bg-violet-100 text-violet-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {data.eventType === 'facility' ? '会館予約由来' : '予定'}
              </span>
            )}
            {data.isMajor && (
              <span className="flex items-center gap-0.5 text-xs text-orange-500">
                <Star size={12} fill="currentColor" /> 主な予定
              </span>
            )}
          </div>
        )}
      </div>
    </Popover>
  );
}
