import { useState } from 'react';
import { Pencil, Trash2, X, Clock, MapPin, Users, AlignLeft, Star, Check, Type } from 'lucide-react';
import Popover from './Popover';

const TIME_OPTIONS: string[] = [];
for (let h = 7; h <= 21; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

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
  displayTitle?: string | null;
  rooms?: string[];
  // booking fields
  room?: string;
  slot?: string;
  orgName?: string | null;
}

interface DetailPopoverProps {
  anchorRect: { top: number; left: number; width: number; height: number };
  data: DetailData;
  onClose: () => void;
  onEdit: (data: DetailData) => void;
  onRefresh: () => void;
  onSwitchToFacility?: (eventId: string, date: string) => void;
}

export default function DetailPopover({ anchorRect, data, onClose, onEdit, onRefresh, onSwitchToFacility }: DetailPopoverProps) {
  const d = new Date(data.date + 'T00:00:00');
  const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日 (${DOW[d.getDay()]})`;
  // ローカルstate（即反映用）
  const [localDisplayTitle, setLocalDisplayTitle] = useState(data.displayTitle);
  const [localStartTime, setLocalStartTime] = useState(data.startTime);
  const [localEndTime, setLocalEndTime] = useState(data.endTime);

  const [editingDisplayTitle, setEditingDisplayTitle] = useState(false);
  const [displayTitleValue, setDisplayTitleValue] = useState('');
  const [editingTime, setEditingTime] = useState(false);
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');

  const handleSaveTime = async () => {
    const s = timeStart || null;
    const e = timeEnd || null;
    setLocalStartTime(s);
    setLocalEndTime(e);
    setEditingTime(false);
    await supaFetch(`calendar_events?id=eq.${data.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ start_time: s, end_time: e }),
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    });
    onRefresh();
  };

  const handleSaveDisplayTitle = async () => {
    const val = displayTitleValue.trim() || null;
    setLocalDisplayTitle(val);
    setEditingDisplayTitle(false);
    await supaFetch(`calendar_events?id=eq.${data.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ display_title: val }),
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    });
    onRefresh();
  };

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

  // 時間表示（ローカルstate優先）
  const effectiveStartTime = data.type === 'event' ? localStartTime : data.startTime;
  const effectiveEndTime = data.type === 'event' ? localEndTime : data.endTime;
  let timeLabel = '';
  if (data.type === 'booking' && data.slot) {
    timeLabel = data.slot;
    if (data.startTime) timeLabel += ` ${data.startTime}`;
    if (data.endTime) timeLabel += `〜${data.endTime}`;
  } else if (effectiveStartTime) {
    timeLabel = effectiveStartTime;
    if (effectiveEndTime) timeLabel += `〜${effectiveEndTime}`;
  }

  // 場所/部屋（結合表示）
  let locationLabel: string | undefined;
  if (data.type === 'booking') {
    locationLabel = data.room;
  } else if (data.location && data.rooms && data.rooms.length > 0) {
    locationLabel = `${data.location}（${data.rooms.map(r => { const m: Record<string,string> = {'会議室':'会議室','和室（畳側）':'和室(畳)','和室（椅子側）':'和室(椅子)','図書室':'図書室'}; return m[r] || r; }).join('・')}）`;
  } else {
    locationLabel = data.location || undefined;
  }

  const isFacilityEvent = data.type === 'event' && data.eventType === 'facility';

  return (
    <Popover anchorRect={anchorRect} onClose={onClose} width={340}>
      {/* ヘッダーアクション */}
      <div className="flex items-center justify-end gap-1 px-3 pt-3 pb-1">
        {data.type === 'event' && (
          <button onClick={async () => {
            await supaFetch(`calendar_events?id=eq.${data.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ is_major: !data.isMajor }),
              headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            });
            onClose();
            onRefresh();
          }} className="p-1.5 hover:bg-gray-100 rounded-full" title={data.isMajor ? '主な予定を解除' : '主な予定にする'}>
            <Star size={16} className={data.isMajor ? 'text-orange-400' : 'text-gray-300'} fill={data.isMajor ? 'currentColor' : 'none'} />
          </button>
        )}
        {!isFacilityEvent && (
          <>
            <button onClick={() => onEdit(data)} className="p-1.5 hover:bg-gray-100 rounded-full" title="編集">
              <Pencil size={16} className="text-gray-500" />
            </button>
            <button onClick={handleDelete} className="p-1.5 hover:bg-gray-100 rounded-full" title="削除">
              <Trash2 size={16} className="text-gray-500" />
            </button>
          </>
        )}
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

        {/* 団体 */}
        {(data.orgName || data.memo) && (
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Users size={16} className="text-gray-400 flex-shrink-0" />
            <span>{data.orgName || data.memo}</span>
          </div>
        )}

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

        {/* タイプバッジ + facility注意書き */}
        {(data.type === 'event' || data.isMajor) && (
          <div className="flex items-center gap-2 pt-1 flex-wrap">
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
        {/* display_title編集（facility型イベント） */}
        {isFacilityEvent && data.type === 'event' && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Type size={12} />
              <span>カレンダー用タイトル</span>
            </div>
            {editingDisplayTitle ? (
              <div className="flex items-center gap-1.5">
                <input value={displayTitleValue} onChange={e => setDisplayTitleValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveDisplayTitle(); if (e.key === 'Escape') setEditingDisplayTitle(false); }}
                  className="flex-1 px-2 py-1.5 text-sm border border-blue-300 rounded-lg focus:outline-none focus:border-blue-500"
                  autoFocus placeholder={data.title} />
                <button onClick={handleSaveDisplayTitle} className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <button onClick={() => { setEditingDisplayTitle(true); setDisplayTitleValue(localDisplayTitle || ''); }}
                className="w-full text-left px-2 py-1.5 text-sm border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <span className={localDisplayTitle ? 'text-gray-800' : 'text-gray-400 italic'}>
                  {localDisplayTitle || '（クリックして設定）'}
                </span>
              </button>
            )}
          </div>
        )}
        {/* カレンダー用時間（facility型イベント） */}
        {isFacilityEvent && data.type === 'event' && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock size={12} />
              <span>カレンダー用時間</span>
            </div>
            {editingTime ? (
              <div className="flex items-center gap-1.5">
                <select value={timeStart} onChange={e => setTimeStart(e.target.value)}
                  className="flex-1 px-1.5 py-1 border border-blue-300 rounded text-sm focus:outline-none">
                  <option value="">開始</option>
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span className="text-gray-400 text-xs">〜</span>
                <select value={timeEnd} onChange={e => setTimeEnd(e.target.value)}
                  className="flex-1 px-1.5 py-1 border border-blue-300 rounded text-sm focus:outline-none">
                  <option value="">終了</option>
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={handleSaveTime} className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <button onClick={() => { setEditingTime(true); setTimeStart(localStartTime || ''); setTimeEnd(localEndTime || ''); }}
                className="w-full text-left px-2 py-1.5 text-sm border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <span className={localStartTime ? 'text-gray-800' : 'text-gray-400 italic'}>
                  {localStartTime && localEndTime ? `${localStartTime}〜${localEndTime}` : '（クリックして設定）'}
                </span>
              </button>
            )}
          </div>
        )}
        {isFacilityEvent && onSwitchToFacility && (
          <button
            onClick={() => { onClose(); onSwitchToFacility(data.id, data.date); }}
            className="w-full text-sm text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl py-2 font-medium transition-colors"
          >
            会館予約タブに移動する
          </button>
        )}
      </div>
    </Popover>
  );
}
