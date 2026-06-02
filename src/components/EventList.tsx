import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Clock, MapPin, Check, MoreVertical, Star } from 'lucide-react';
import { EventSummary } from '../types';
import { shortRoomName, ROOMS, TIME_SLOTS } from '../constants';

const WEEK_DAYS = ['月', '火', '水', '木', '金', '土', '日'];

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface EventListProps {
  holidays: Record<string, string>;
  closures: Set<string>;
  onDateClick?: (date: Date) => void;
  onCellClick?: (date: Date, rect: DOMRect) => void;
  onItemClick?: (event: EventSummary, rect: DOMRect) => void;
  refreshKey?: number;
  isAdmin?: boolean;
}

function isMajorEvent(evt: { isMajor?: boolean }): boolean {
  return evt.isMajor === true;
}

export default function EventList({ holidays, closures, onDateClick, onCellClick, onItemClick, refreshKey, isAdmin }: EventListProps) {
  const [subView, setSubView] = useState<'month' | 'list'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [itemDetail, setItemDetail] = useState<{ event: EventSummary; anchor: DOMRect } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchEvents = useCallback(async (y: number, m: number, bustCache?: boolean) => {
    setLoading(true);
    try {
      const cacheBust = bustCache ? `&nocache=${Date.now()}` : '';
      const res = await fetch(`/api/events?year=${y}&month=${m + 1}&visibility=public${cacheBust}`);
      if (!res.ok) throw new Error('API error');
      const data: EventSummary[] = await res.json();
      setEvents(data);
    } catch (err) {
      console.error('イベント取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const [prevRefreshKey, setPrevRefreshKey] = useState(refreshKey);
  useEffect(() => {
    const bustCache = refreshKey !== prevRefreshKey;
    if (bustCache) setPrevRefreshKey(refreshKey);
    fetchEvents(year, month, bustCache);
  }, [year, month, fetchEvents, refreshKey]);

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // 日付→イベントのマップ
  const eventsByDate: Record<string, EventSummary[]> = {};
  events.forEach(e => {
    if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
    eventsByDate[e.date].push(e);
  });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;

  const generateCalendarDays = () => {
    const days = [];

    // 空セル（前月分）
    for (let i = 0; i < mondayOffset; i++) {
      days.push(<div key={`empty-${i}`} className="min-h-[6.5rem] bg-gray-50 border border-gray-100" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = eventsByDate[dateStr] || [];
      const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
      const dow = new Date(year, month, day).getDay();
      const holidayName = holidays[dateStr];
      const isHoliday = !!holidayName;
      const isClosure = closures.has(dateStr);
      const MAX_DISPLAY = 3;

      days.push(
        <div
          key={day}
          onClick={(e) => {
            setSelectedEventId(null);
            const d = new Date(year, month, day);
            if (onCellClick) {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              onCellClick(d, rect);
            } else if (onDateClick) { onDateClick(d); }
          }}
          data-cell
          className={`min-h-[8rem] border border-gray-200 relative transition-colors flex flex-col ${
            onCellClick || onDateClick || dayEvents.length > 0 ? 'cursor-pointer hover:bg-blue-50/30' : ''
          } ${isToday ? 'outline outline-2 outline-blue-400 -outline-offset-1 z-10' : ''} ${isClosure ? 'bg-gray-50' : ''}`}
        >
          {/* 日付 */}
          <div className="px-1 pt-0.5 shrink-0 flex items-center gap-1 overflow-hidden">
            <span className={`text-xs font-bold ${
              isToday ? 'bg-blue-600 text-white px-1 rounded' :
              (isHoliday || dow === 0) ? 'text-red-500' :
              dow === 6 ? 'text-blue-500' : 'text-gray-600'
            }`}>
              {day}
            </span>
            {isClosure && <span className="text-[10px] bg-orange-400 text-white px-1.5 py-px rounded font-bold shrink-0 whitespace-nowrap">休館</span>}
            {holidayName && <span className="text-xs text-red-400 truncate min-w-0">{holidayName}</span>}
          </div>

          {/* イベント: 主要=カラー背景ラベル、詳細=グレードット */}
          <div className="flex-1 px-0.5 py-0.5 overflow-hidden space-y-px">
            {dayEvents.filter(e => isMajorEvent(e)).sort((a, b) => {
              const aTime = a.startTime || '';
              const bTime = b.startTime || '';
              if (!aTime && bTime) return -1;
              if (aTime && !bTime) return 1;
              return aTime.localeCompare(bTime);
            }).map(evt => (
              <div key={evt.id} onClick={e => { e.stopPropagation(); setSelectedEventId(evt.id); if (onItemClick) { onItemClick(evt, (e.currentTarget as HTMLElement).getBoundingClientRect()); } else { setItemDetail({ event: evt, anchor: (e.currentTarget as HTMLElement).getBoundingClientRect() }); } }}
                className={`text-xs font-bold rounded px-1 py-0.5 truncate cursor-pointer transition-colors ${
                  selectedEventId === evt.id ? 'bg-blue-200 text-blue-900 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)] relative z-10' : 'text-blue-700 bg-blue-100 hover:bg-blue-200'
                }`}>
                {evt.title}
              </div>
            ))}
            {dayEvents.filter(e => !isMajorEvent(e)).slice(0, MAX_DISPLAY).map(evt => (
              <div key={evt.id} onClick={e => { e.stopPropagation(); setSelectedEventId(evt.id); if (onItemClick) { onItemClick(evt, (e.currentTarget as HTMLElement).getBoundingClientRect()); } else { setItemDetail({ event: evt, anchor: (e.currentTarget as HTMLElement).getBoundingClientRect() }); } }}
                className={`text-xs text-gray-800 rounded flex items-center gap-1 px-0.5 py-px overflow-hidden cursor-pointer transition-colors ${
                  selectedEventId === evt.id ? 'bg-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)] rounded-sm relative z-10' : 'hover:bg-gray-200'
                }`}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-gray-300" />
                <span className="truncate">{evt.title}</span>
              </div>
            ))}
            {dayEvents.filter(e => !isMajorEvent(e)).length > MAX_DISPLAY && (
              <div className="text-xs text-gray-400 pl-1">+{dayEvents.filter(e => !isMajorEvent(e)).length - MAX_DISPLAY}</div>
            )}
          </div>
        </div>,
      );
    }

    return days;
  };

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <div className="flex items-center gap-2">
            <h2 className="text-[22px] font-normal text-gray-800 flex items-center gap-2">
              {year}年 {month + 1}月
              {loading && <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />}
            </h2>
            <div className="flex gap-1">
              <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ChevronLeft size={20} className="text-gray-500" />
              </button>
              <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ChevronRight size={20} className="text-gray-500" />
              </button>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center bg-gray-100 rounded-full p-0.5">
              {(['month', 'list'] as const).map(v => (
                <button key={v} onClick={() => setSubView(v)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    subView === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {v === 'month' ? '月' : '一覧'}
                </button>
              ))}
            </div>
          )}
        </div>

        {subView === 'month' ? (
        <>
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 text-center bg-gray-50 border-b border-gray-200">
          {WEEK_DAYS.map((d, i) => (
            <div key={d} className={`py-2 text-sm font-bold ${i === 6 ? 'text-red-500' : i === 5 ? 'text-blue-500' : 'text-gray-600'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* カレンダーグリッド */}
        <div className="grid grid-cols-7">
          {generateCalendarDays()}
        </div>

        {/* 凡例 */}
        <div className="flex flex-wrap gap-3 p-3 border-t border-gray-100 text-xs text-gray-500 items-center">
          <span className="flex items-center gap-1"><span className="w-4 h-3 bg-blue-100 rounded text-[8px] text-blue-700 font-bold flex items-center justify-center">例</span>主な予定</span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-gray-300 rounded-full" />詳細予定</span>
        </div>
        </>
        ) : (
        <EventSheetView events={events} year={year} month={month} holidays={holidays} onRefresh={() => fetchEvents(year, month)} />
        )}
      </div>

      {/* 日付クリック時のポップオーバー */}
      {/* 個別アイテム詳細ポップオーバー（ユーザー側） */}
      {itemDetail && (() => {
        const evt = itemDetail.event;
        const d = new Date(evt.date + 'T00:00:00');
        const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
        const timeStr = evt.startTime && evt.endTime ? `${evt.startTime}〜${evt.endTime}` : null;
        const roomStr = evt.rooms.length > 0 ? evt.rooms.map(r => shortRoomName(r)).join('・') : null;
        const locationStr = evt.location && roomStr ? `${evt.location}（${roomStr}）` : evt.location || roomStr;
        const vw = window.innerWidth; const vh = window.innerHeight;
        let left = itemDetail.anchor.left + itemDetail.anchor.width + 8;
        if (left + 300 > vw - 16) left = itemDetail.anchor.left - 300 - 8;
        if (left < 16) left = 16;
        let top = itemDetail.anchor.top;
        if (top + 160 > vh - 16) top = vh - 160 - 16;
        if (top < 16) top = 16;
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => { setItemDetail(null); setSelectedEventId(null); }} />
            <div className="bg-gray-50 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] border border-gray-200 overflow-hidden" style={{ position: 'fixed', left, top, zIndex: 50, width: 300 }}>
              <div className="flex items-center justify-end px-3 pt-2">
                <button onClick={() => { setItemDetail(null); setSelectedEventId(null); }} className="p-1 hover:bg-gray-200 rounded-full">
                  <X size={14} className="text-gray-400" />
                </button>
              </div>
              <div className="px-4 pb-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-sm shrink-0 ${evt.isMajor ? 'bg-blue-500' : 'bg-blue-400'}`} />
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{evt.title}</h3>
                    <p className="text-xs text-gray-500">{d.getMonth() + 1}月{d.getDate()}日 ({dow})</p>
                  </div>
                </div>
                {timeStr && (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Clock size={14} className="text-gray-500" />
                    <span>{timeStr}</span>
                  </div>
                )}
                {locationStr && (
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <MapPin size={14} className="text-gray-500" />
                    <span>{locationStr}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}
    </>
  );
}

/** 日別イベント詳細ポップオーバー */
function EventDayPopover({ date, events, anchorRect, onClose }: { date: Date; events: EventSummary[]; anchorRect: DOMRect | null; onClose: () => void }) {
  const dow = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];

  if (events.length === 0) return null;

  let style: React.CSSProperties = {};
  if (anchorRect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchorRect.left + anchorRect.width + 8;
    if (left + 340 > vw - 16) left = anchorRect.left - 340 - 8;
    if (left < 16) left = 16;
    let top = anchorRect.top;
    if (top + 300 > vh - 16) top = vh - 300 - 16;
    if (top < 16) top = 16;
    style = { position: 'fixed', left, top, zIndex: 50, width: 340 };
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-[70vh] flex flex-col" style={style}>
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h3 className="text-base font-bold text-gray-800">
            {date.getMonth() + 1}月{date.getDate()}日({dow})
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* イベント一覧 */}
        <div className="flex-1 overflow-auto px-4 pb-3 divide-y divide-gray-100">
          {events.map(evt => {
            const timeStr = evt.startTime && evt.endTime ? `${evt.startTime}〜${evt.endTime}` : null;
            const roomStr = evt.rooms.length > 0 ? evt.rooms.map(r => shortRoomName(r)).join('・') : null;
            const locationStr = evt.location && roomStr ? `${evt.location}（${roomStr}）` : evt.location || roomStr;

            return (
              <div key={evt.id} className="py-2.5 first:pt-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${
                    evt.isMajor ? 'bg-blue-500' : evt.eventType === 'general' ? 'bg-blue-400' : 'bg-gray-400'
                  }`} />
                  <span className="text-sm font-medium text-gray-900">{evt.title}</span>
                </div>
                <div className="flex items-center gap-4 mt-1 pl-[18px]">
                  {timeStr && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock size={12} className="text-gray-400" />
                      {timeStr}
                    </span>
                  )}
                  {locationStr && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin size={12} className="text-gray-400" />
                      {locationStr}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/** カレンダー一覧ビュー（display_title編集対応 + ⋮メニュー） */
function EventSheetView({ events, year, month, holidays, onRefresh }: {
  events: EventSummary[]; year: number; month: number; holidays: Record<string, string>; onRefresh: () => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editSlotId, setEditSlotId] = useState<string | null>(null);
  const [editRoomId, setEditRoomId] = useState<string | null>(null);

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));

  const supaPatch = async (path: string, body: any) => {
    return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: 'PATCH', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(body),
    });
  };

  const handleSave = async (id: string) => {
    await supaPatch(`calendar_events?id=eq.${id}`, { display_title: editValue.trim() || null });
    setEditId(null);
    onRefresh();
  };

  const handleToggleMajor = async (evt: EventSummary) => {
    await supaPatch(`calendar_events?id=eq.${evt.id}`, { is_major: !evt.isMajor });
    setMenuId(null);
    onRefresh();
  };

  const handleDelete = async (evt: EventSummary) => {
    if (!confirm(`「${evt.title}」を削除しますか？`)) return;
    await fetch(`${SUPABASE_URL}/rest/v1/calendar_events?id=eq.${evt.id}`, {
      method: 'DELETE', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'return=minimal' },
    });
    setMenuId(null);
    onRefresh();
  };

  const handleSaveSlot = async (evtId: string, newSlot: string) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bookings?event_id=eq.${evtId}&status=in.(CONFIRMED,PENDING)&select=id`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    const bks = res.ok ? await res.json() : [];
    if (bks.length === 0) { setEditSlotId(null); return; }
    const slot = TIME_SLOTS.find(s => s.gasKey === newSlot);
    if (!slot) return;
    const patchRes = await supaPatch(`bookings?id=eq.${bks[0].id}`, { slot: newSlot });
    if (!patchRes.ok) {
      const err = await patchRes.text();
      alert(err.includes('23505') ? 'この時間帯・部屋は既に予約されています' : '保存に失敗しました');
      setEditSlotId(null);
      return;
    }
    await supaPatch(`calendar_events?id=eq.${evtId}`, { start_time: slot.startTime, end_time: slot.endTime });
    setEditSlotId(null);
    onRefresh();
  };

  const handleSaveRoom = async (evtId: string, newRoom: string) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bookings?event_id=eq.${evtId}&status=in.(CONFIRMED,PENDING)&select=id`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    });
    const bks = res.ok ? await res.json() : [];
    if (bks.length === 0) { setEditRoomId(null); return; }
    const patchRes = await supaPatch(`bookings?id=eq.${bks[0].id}`, { room: newRoom });
    if (!patchRes.ok) {
      const err = await patchRes.text();
      alert(err.includes('23505') ? 'この時間帯・部屋は既に予約されています' : '保存に失敗しました');
      setEditRoomId(null);
      return;
    }
    setEditRoomId(null);
    onRefresh();
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 sticky top-0">
          <tr className="text-left">
            <th className="px-3 py-2 text-xs font-bold text-gray-500 w-24">日付</th>
            <th className="px-1 py-2 text-xs font-bold text-gray-500 w-8">★</th>
            <th className="px-3 py-2 text-xs font-bold text-gray-500">元タイトル</th>
            <th className="px-3 py-2 text-xs font-bold text-gray-500">カレンダー用タイトル</th>
            <th className="px-3 py-2 text-xs font-bold text-gray-500 w-14">時間</th>
            <th className="px-3 py-2 text-xs font-bold text-gray-500 w-20">場所</th>
            <th className="px-3 py-2 text-xs font-bold text-gray-500 w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.length === 0 ? (
            <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-300">予定はありません</td></tr>
          ) : sorted.map(evt => {
            const d = new Date(evt.date + 'T00:00:00');
            const dow = d.getDay();
            const isHoliday = !!holidays[evt.date] || dow === 0;
            const isEditing = editId === evt.id;

            return (
              <tr key={evt.id} className="hover:bg-gray-50">
                <td className={`px-3 py-2 whitespace-nowrap ${isHoliday ? 'text-red-500' : dow === 6 ? 'text-blue-500' : ''}`}>
                  {d.getMonth() + 1}/{d.getDate()}({DOW_LABELS[dow]})
                </td>
                <td className="px-1 py-2 text-center">
                  <button onClick={e => { e.stopPropagation(); handleToggleMajor(evt); }} title={evt.isMajor ? '主な予定を解除' : '主な予定にする'}>
                    <Star size={14} className={evt.isMajor ? 'text-orange-400' : 'text-gray-300 hover:text-orange-300'} fill={evt.isMajor ? 'currentColor' : 'none'} />
                  </button>
                </td>
                <td className="px-3 py-2 text-gray-500">{evt.originalTitle || evt.title}</td>
                <td className="px-3 py-2" onClick={() => { setEditId(evt.id); setEditValue(evt.displayTitle || ''); }}>
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <input value={editValue} onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSave(evt.id); if (e.key === 'Escape') setEditId(null); }}
                        className="flex-1 px-1.5 py-0.5 border border-blue-300 rounded text-sm focus:outline-none" autoFocus placeholder="空欄で元タイトルを使用" />
                      <button onClick={e => { e.stopPropagation(); handleSave(evt.id); }} className="text-blue-500"><Check size={14} /></button>
                    </div>
                  ) : (
                    <span className={`cursor-text hover:underline ${evt.displayTitle ? 'font-medium text-gray-900' : 'text-gray-300 italic'}`}>
                      {evt.displayTitle || '（クリックして設定）'}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs" onClick={() => { if (evt.eventType === 'facility' && evt.slots.length === 1) setEditSlotId(evt.id); }}>
                  {editSlotId === evt.id ? (
                    <select defaultValue={evt.slots[0]} onChange={e => handleSaveSlot(evt.id, e.target.value)} onBlur={() => setEditSlotId(null)} autoFocus
                      className="px-1 py-0.5 border border-blue-300 rounded text-xs focus:outline-none">
                      {TIME_SLOTS.map(s => <option key={s.id} value={s.gasKey}>{s.gasKey}</option>)}
                    </select>
                  ) : evt.eventType === 'facility' && evt.slots.length === 1 ? (
                    <span className="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded">{evt.slots[0]}</span>
                  ) : (
                    evt.startTime && evt.endTime ? `${evt.startTime}〜${evt.endTime}` : '終日'
                  )}
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs" onClick={() => { if (evt.eventType === 'facility' && evt.rooms.length === 1) setEditRoomId(evt.id); }}>
                  {editRoomId === evt.id ? (
                    <select defaultValue={evt.rooms[0]} onChange={e => handleSaveRoom(evt.id, e.target.value)} onBlur={() => setEditRoomId(null)} autoFocus
                      className="px-1 py-0.5 border border-blue-300 rounded text-xs focus:outline-none">
                      {ROOMS.map(r => <option key={r.id} value={r.id}>{r.shortName}</option>)}
                    </select>
                  ) : evt.eventType === 'facility' && evt.rooms.length === 1 ? (
                    <span className="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded">{shortRoomName(evt.rooms[0])}</span>
                  ) : (
                    evt.location && evt.rooms.length > 0 ? `${evt.location}（${evt.rooms.map(r => shortRoomName(r)).join('・')}）` : evt.location || (evt.rooms.length > 0 ? evt.rooms.map(r => shortRoomName(r)).join('・') : '')
                  )}
                </td>
                <td className="px-3 py-2 text-right relative">
                  <button onClick={e => { e.stopPropagation(); setMenuId(menuId === evt.id ? null : evt.id); }} className="p-1 hover:bg-gray-200 rounded-full">
                    <MoreVertical size={14} className="text-gray-400" />
                  </button>
                  {menuId === evt.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuId(null)} />
                      <div className="absolute right-0 top-8 z-50 bg-white rounded-xl shadow-lg border border-gray-200 py-1 w-40">
                        <button onClick={() => handleToggleMajor(evt)} className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50">
                          {evt.isMajor ? '☆ 主な予定を解除' : '★ 主な予定にする'}
                        </button>
                        {evt.eventType !== 'facility' && (
                          <button onClick={() => handleDelete(evt)} className="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-red-50">削除</button>
                        )}
                      </div>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
