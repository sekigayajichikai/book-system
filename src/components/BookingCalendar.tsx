import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Clock, MapPin, MoreVertical, Check, Users, AlignLeft } from 'lucide-react';
import { Booking } from '../types';
import { ROOMS, TIME_SLOTS, shortRoomName } from '../constants';

interface CalendarProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  bookings: Booking[];
  onDateClick?: (date: Date) => void;
  onCellClick?: (date: Date, rect: DOMRect) => void;
  onItemClick?: (booking: Booking, rect: DOMRect) => void;
  onOverflowClick?: (date: Date, rect: DOMRect) => void;
  onEditBookingClick?: (booking: Booking, rect: DOMRect) => void;
  onRefreshBookings?: () => void;
  holidays?: Record<string, string>;
  closures?: Set<string>;
  disableModal?: boolean;
  loading?: boolean;
  modeToggle?: React.ReactNode;
  subTitle?: string;
}

const ROOM_COLORS: Record<string, { bg: string; bar: string }> = {
  '会議室':       { bg: 'bg-[var(--room-kaigi)]', bar: 'bg-yellow-400' },
  '和室（畳側）':  { bg: 'bg-[var(--room-washi)]', bar: 'bg-sky-400' },
  '和室（椅子側）': { bg: 'bg-[var(--room-washi)]', bar: 'bg-sky-400' },
  '図書室':       { bg: 'bg-[var(--room-tosho)]', bar: 'bg-pink-400' },
};

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** --- Day Detail Popover (月カレンダーのセルクリック用・ポップオーバー) --- */
const DayDetailPopover: React.FC<{
  date: Date;
  bookings: Booking[];
  anchorRect: DOMRect | null;
  onClose: () => void;
}> = ({ date, bookings, anchorRect, onClose }) => {
  const dow = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
  const ref = useRef<HTMLDivElement>(null);

  const dayBookings = bookings.filter(b => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return b.date === dateStr;
  });

  if (dayBookings.length === 0) return null;

  // ポップオーバー位置計算
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
      <div ref={ref} className="bg-gray-50 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] border border-gray-200 overflow-hidden max-h-[70vh] flex flex-col" style={style}>
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h3 className="text-base font-bold text-gray-800">
            {date.getMonth() + 1}月{date.getDate()}日({dow})
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-full">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* イベント一覧 */}
        <div className="flex-1 overflow-auto px-3 pb-3 space-y-1">
          {dayBookings.map((b, i) => {
            const colors = ROOM_COLORS[b.room] || { bar: 'bg-gray-400' };
            return (
              <div key={i} className="bg-white rounded-xl px-3 py-2.5 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-2">
                  <span className={`${colors.bar} w-2.5 h-2.5 rounded-sm shrink-0`} />
                  <span className="text-sm font-semibold text-gray-900">{b.title}</span>
                </div>
                <div className="flex items-center gap-4 mt-1 pl-[18px]">
                  <span className="flex items-center gap-1 text-xs text-gray-600">
                    <Clock size={12} className="text-gray-500" />
                    {b.startTime}〜{b.endTime}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-600">
                    <MapPin size={12} className="text-gray-500" />
                    {shortRoomName(b.room)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

/** --- Sheet/List View (一覧表示) --- */
const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
const BookingSheetView: React.FC<{
  bookings: Booking[];
  year: number;
  month: number;
  holidays: Record<string, string>;
  onItemClick?: (booking: Booking, rect: DOMRect) => void;
  onEditClick?: (booking: Booking, rect: DOMRect) => void;
  onRefresh?: () => void;
}> = ({ bookings, year, month, holidays, onItemClick, onEditClick, onRefresh }) => {
  const [orgMap, setOrgMap] = useState<Record<string, string>>({});
  const [editCell, setEditCell] = useState<{ id: string; field: 'title' | 'org' } | null>(null);
  const [editValue, setEditValue] = useState('');

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
  const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const supaPatch = async (path: string, body: any) => {
    await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: 'PATCH', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(body),
    });
  };

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/bookings?date=gte.${year}-${String(month + 1).padStart(2, '0')}-01&date=lt.${month === 11 ? year + 1 : year}-${String(month === 11 ? 1 : month + 2).padStart(2, '0')}-01&select=id,booking_organizations(name)`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    }).then(r => r.json()).then(data => {
      const map: Record<string, string> = {};
      (data || []).forEach((b: any) => { if (b.booking_organizations?.name) map[b.id] = b.booking_organizations.name; });
      setOrgMap(map);
    }).catch(() => {});
  }, [year, month, bookings]);

  const slotOrder: Record<string, number> = { '09:00': 0, '13:00': 1, '17:00': 2 };
  const monthBookings = bookings
    .filter(b => { const d = new Date(b.date + 'T00:00:00'); return d.getFullYear() === year && d.getMonth() === month; })
    .sort((a, b) => a.date.localeCompare(b.date) || (slotOrder[a.startTime] ?? 0) - (slotOrder[b.startTime] ?? 0) || a.room.localeCompare(b.room));

  const slotLabel = (startTime: string) => startTime === '09:00' ? '午前' : startTime === '13:00' ? '午後' : '夜間';

  const handleSave = async (b: Booking) => {
    if (!editCell) return;
    if (editCell.field === 'title') {
      if (editValue.trim()) await supaPatch(`bookings?id=eq.${b.id}`, { title: editValue.trim() });
    } else {
      // 団体名からorg_idを検索
      let orgId: string | null = null;
      if (editValue.trim()) {
        try {
          const res = await fetch(`${SUPABASE_URL}/rest/v1/booking_organizations?name=eq.${encodeURIComponent(editValue.trim())}&select=id&limit=1`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
          });
          const d = await res.json(); orgId = d[0]?.id || null;
        } catch {}
      }
      await supaPatch(`bookings?id=eq.${b.id}`, { org_id: orgId });
    }
    setEditCell(null);
    onRefresh?.();
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="text-left">
              <th className="px-3 py-2 text-xs font-bold text-gray-500 w-24">日付</th>
              <th className="px-3 py-2 text-xs font-bold text-gray-500 w-14">時間帯</th>
              <th className="px-3 py-2 text-xs font-bold text-gray-500 w-20">部屋</th>
              <th className="px-3 py-2 text-xs font-bold text-gray-500">団体</th>
              <th className="px-3 py-2 text-xs font-bold text-gray-500">タイトル</th>
              <th className="px-3 py-2 text-xs font-bold text-gray-500 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {monthBookings.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-300">予約はありません</td></tr>
            ) : monthBookings.map(b => {
              const d = new Date(b.date + 'T00:00:00');
              const dow = d.getDay();
              const isHoliday = !!holidays[b.date] || dow === 0;
              const colors = ROOM_COLORS[b.room] || { bar: 'bg-gray-400' };
              const isEditingOrg = editCell?.id === b.id && editCell.field === 'org';
              const isEditingTitle = editCell?.id === b.id && editCell.field === 'title';
              return (
                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                  <td className={`px-3 py-2 whitespace-nowrap ${isHoliday ? 'text-red-500' : dow === 6 ? 'text-blue-500' : ''}`}>
                    {d.getMonth() + 1}/{d.getDate()}({DOW_LABELS[dow]})
                  </td>
                  <td className="px-3 py-2">{slotLabel(b.startTime)}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      <span className={`${colors.bar} w-2 h-2 rounded-full shrink-0`} />
                      {shortRoomName(b.room)}
                    </span>
                  </td>
                  <td className="px-3 py-2" onClick={e => { e.stopPropagation(); setEditCell({ id: b.id, field: 'org' }); setEditValue(orgMap[b.id] || ''); }}>
                    {isEditingOrg ? (
                      <div className="flex items-center gap-1">
                        <input value={editValue} onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSave(b); if (e.key === 'Escape') setEditCell(null); }}
                          className="flex-1 px-1.5 py-0.5 border border-blue-300 rounded text-sm focus:outline-none" autoFocus />
                        <button onClick={e => { e.stopPropagation(); handleSave(b); }} className="text-blue-500"><Check size={14} /></button>
                      </div>
                    ) : (
                      <span className="text-gray-500 hover:text-gray-800 hover:underline cursor-text">{orgMap[b.id] || '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2" onClick={e => { e.stopPropagation(); setEditCell({ id: b.id, field: 'title' }); setEditValue(b.title); }}>
                    {isEditingTitle ? (
                      <div className="flex items-center gap-1">
                        <input value={editValue} onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSave(b); if (e.key === 'Escape') setEditCell(null); }}
                          className="flex-1 px-1.5 py-0.5 border border-blue-300 rounded text-sm focus:outline-none" autoFocus />
                        <button onClick={e => { e.stopPropagation(); handleSave(b); }} className="text-blue-500"><Check size={14} /></button>
                      </div>
                    ) : (
                      <span className="font-medium text-gray-800 hover:underline cursor-text">{b.title}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={e => { e.stopPropagation(); const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); if (onEditClick) onEditClick(b, rect); else if (onItemClick) onItemClick(b, rect); }} className="p-1 hover:bg-gray-200 rounded-full">
                      <MoreVertical size={14} className="text-gray-400" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/** --- Weekly Sub-View (月カレンダー内の週表示) --- */
const CalendarWeeklyView: React.FC<{
  weekStart: Date;
  bookings: Booking[];
  onPrevWeek: () => void;
  onNextWeek: () => void;
  holidays?: Record<string, string>;
  onItemClick?: (booking: Booking, rect: DOMRect) => void;
}> = ({ weekStart, bookings, onPrevWeek, onNextWeek, holidays = {}, onItemClick }) => {
  const weekDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    weekDates.push(d);
  }

  const dowNames = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div>
      {/* Week nav */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrevWeek} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronLeft size={20} className="text-gray-500" />
        </button>
        <span className="text-sm font-bold text-gray-700">
          {weekDates[0].getMonth() + 1}月{weekDates[0].getDate()}日 〜 {weekDates[6].getMonth() + 1}月{weekDates[6].getDate()}日
        </span>
        <button onClick={onNextWeek} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ChevronRight size={20} className="text-gray-500" />
        </button>
      </div>

      {/* 7-column grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Header */}
        {weekDates.map((date, i) => {
          const dow = date.getDay();
          const today = new Date().toDateString() === date.toDateString();
          const hName = holidays[formatDate(date)];
          const isH = !!hName;
          return (
            <div key={i} className={`text-center py-1.5 rounded-lg ${today ? 'bg-emerald-600 text-white' : ''}`}>
              <div className={`text-xs font-medium ${
                today ? 'text-emerald-100' : (isH || dow === 0) ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-500'
              }`}>
                {dowNames[dow]}
              </div>
              <div className={`text-sm font-bold ${today ? 'text-white' : (isH || dow === 0) ? 'text-red-500' : 'text-gray-800'}`}>
                {date.getDate()}
              </div>
              {hName && !today && <div className="text-xs text-red-400 truncate">{hName}</div>}
            </div>
          );
        })}

        {/* Day columns */}
        {weekDates.map((date, i) => {
          const dateStr = formatDate(date);
          const dayBookings = bookings.filter(b => b.date === dateStr);
          const dow = date.getDay();
          const today = new Date().toDateString() === date.toDateString();

          // Group by slot
          const slotGroups = TIME_SLOTS.map(slot => ({
            slot,
            items: dayBookings.filter(b => b.startTime === slot.startTime),
          })).filter(g => g.items.length > 0);

          return (
            <div
              key={i}
              className={`min-h-[10rem] border border-gray-200 rounded-lg p-1 ${
                today ? 'outline outline-2 outline-emerald-400 -outline-offset-1' : ''
              } ${dow === 0 || dow === 6 ? 'bg-gray-50/50' : ''}`}
            >
              {slotGroups.length === 0 ? (
                <div className="text-xs text-gray-300 text-center mt-4">-</div>
              ) : (
                <div className="space-y-1.5">
                  {slotGroups.map(({ slot, items }) => (
                    <div key={slot.id}>
                      <div className="text-xs font-bold text-gray-400 px-0.5">{slot.gasKey}</div>
                      {items.map((b, j) => {
                        const colors = ROOM_COLORS[b.room] || { bar: 'bg-gray-400' };
                        return (
                          <div key={j} className={`flex items-start gap-1 px-0.5 py-px rounded ${onItemClick ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                            onClick={e => { e.stopPropagation(); if (onItemClick) onItemClick(b, (e.currentTarget as HTMLElement).getBoundingClientRect()); }}>
                            <span className={`${colors.bar} w-1.5 h-1.5 rounded-full shrink-0 mt-1`} />
                            <span className="text-xs leading-tight text-gray-700">{b.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-700 items-center">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-yellow-400 rounded-full" />会議室</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-sky-400 rounded-full" />和室</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-pink-400 rounded-full" />図書室</span>
      </div>
    </div>
  );
};

/** --- Main Calendar Component --- */
const BookingCalendar: React.FC<CalendarProps> = ({
  currentDate, onPrevMonth, onNextMonth, bookings, onDateClick, onCellClick, onItemClick, onOverflowClick, onEditBookingClick, onRefreshBookings, holidays = {}, closures = new Set(), disableModal, loading, modeToggle, subTitle,
}) => {
  const [subView, setSubView] = useState<'month' | 'week' | 'list'>('month');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [itemDetail, setItemDetail] = useState<{ booking: Booking; anchor: DOMRect; orgName?: string; memo?: string } | null>(null);
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const cardRef = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState<number | null>(null);

  useEffect(() => {
    const calc = () => {
      if (cardRef.current) {
        const top = cardRef.current.getBoundingClientRect().top;
        setCardHeight(Math.floor(window.innerHeight - top - 12));
      }
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [subView, currentDate]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const weekDays = ['月', '火', '水', '木', '金', '土', '日'];

  const amSlot = TIME_SLOTS.find(s => s.gasKey === '午前');
  const pmSlot = TIME_SLOTS.find(s => s.gasKey === '午後');

  const handleCellClick = (day: number, e: React.MouseEvent) => {
    setSelectedBookingId(null);
    const date = new Date(year, month, day);
    if (onCellClick) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      onCellClick(date, rect);
    } else if (disableModal && onDateClick) {
      onDateClick(date);
    }
  };

  const handleItemClick = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    setSelectedBookingId(booking.id);
    if (onItemClick) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      onItemClick(booking, rect);
    } else {
      // ユーザー側: 個別アイテム詳細ポップオーバー（団体名・メモも取得）
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setItemDetail({ booking, anchor: rect });
      const sbUrl = import.meta.env.VITE_SUPABASE_URL;
      const sbKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (sbUrl && sbKey) {
        fetch(`${sbUrl}/rest/v1/bookings?id=eq.${booking.id}&select=memo,booking_organizations(name)`, {
          headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` },
        }).then(r => r.json()).then(d => {
          if (d[0]) setItemDetail(prev => prev ? { ...prev, orgName: d[0].booking_organizations?.name || undefined, memo: d[0].memo || undefined } : prev);
        }).catch(() => {});
      }
    }
  };

  const generateCalendarDays = () => {
    const days = [];

    const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < mondayOffset; i++) {
      days.push(<div key={`empty-${i}`} className="bg-gray-50 border border-gray-100" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayBookings = bookings.filter(b => b.date === dateStr);
      const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
      const dow = new Date(year, month, day).getDay();
      const holidayName = holidays[dateStr];
      const isHoliday = !!holidayName;
      const isClosure = closures.has(dateStr);

      const amBookings = dayBookings.filter(b => amSlot && b.startTime === amSlot.startTime);
      const pmBookings = dayBookings.filter(b => pmSlot && b.startTime === pmSlot.startTime);

      days.push(
        <div
          key={day}
          data-cell
          onClick={(e) => handleCellClick(day, e)}
          className={`border border-gray-200 relative cursor-pointer hover:bg-emerald-50/30 transition-colors flex flex-col ${isToday ? 'outline outline-2 outline-emerald-400 -outline-offset-1 z-10' : ''} ${isClosure ? 'bg-gray-50' : ''}`}
        >
          {/* Date number */}
          <div className="px-1 pt-0.5 shrink-0 flex items-center gap-1 overflow-hidden">
            <span className={`text-sm font-bold ${
              isToday ? 'bg-emerald-600 text-white px-1 rounded' : (isHoliday || dow === 0) ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-600'
            }`}>
              {day}
            </span>
            {isClosure && <span className="text-xs bg-orange-400 text-white px-1.5 py-px rounded font-bold shrink-0 whitespace-nowrap">休館</span>}
            {holidayName && <span className="text-sm text-red-400 truncate min-w-0">{holidayName}</span>}
          </div>

          <div className="flex flex-col flex-1 min-h-0">
            {/* AM */}
            <div className="flex-1 px-0.5 py-0.5 space-y-px">
              {amBookings.slice(0, 2).map((b, i) => {
                const colors = ROOM_COLORS[b.room] || { bg: 'bg-gray-100', bar: 'bg-gray-400' };
                return (
                  <div key={i} onClick={e => handleItemClick(e, b)} className={`text-sm font-normal text-gray-800 rounded flex items-center gap-1 px-0.5 py-px overflow-hidden cursor-pointer transition-colors ${selectedBookingId === b.id ? 'bg-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)] rounded-sm relative z-10' : 'hover:bg-gray-200'}`}>
                    <span className={`${colors.bar} w-2 h-2 rounded-full shrink-0`} />
                    <span className="truncate">{b.title}</span>
                  </div>
                );
              })}
              {amBookings.length > 2 && (
                <div onClick={e => { e.stopPropagation(); const rect = (e.currentTarget.closest('[data-cell]') as HTMLElement)?.getBoundingClientRect() || new DOMRect(); const d = new Date(year, month, day); if (onOverflowClick) onOverflowClick(d, rect); else if (onCellClick) onCellClick(d, rect); }} className="text-sm text-blue-500 pl-1 cursor-pointer hover:text-blue-700 hover:underline">+{amBookings.length - 2}件</div>
              )}
            </div>

            {/* PM */}
            <div className="flex-1 px-0.5 py-0.5 bg-gray-100 border-t border-[var(--md-outline)] space-y-px">
              {pmBookings.slice(0, 2).map((b, i) => {
                const colors = ROOM_COLORS[b.room] || { bg: 'bg-gray-100', bar: 'bg-gray-400' };
                return (
                  <div key={i} onClick={e => handleItemClick(e, b)} className={`text-sm font-normal text-gray-800 rounded flex items-center gap-1 px-0.5 py-px overflow-hidden cursor-pointer transition-colors ${selectedBookingId === b.id ? 'bg-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)] rounded-sm relative z-10' : 'hover:bg-gray-200'}`}>
                    <span className={`${colors.bar} w-2 h-2 rounded-full shrink-0`} />
                    <span className="truncate">{b.title}</span>
                  </div>
                );
              })}
              {pmBookings.length > 2 && (
                <div onClick={e => { e.stopPropagation(); const rect = (e.currentTarget.closest('[data-cell]') as HTMLElement)?.getBoundingClientRect(); if (rect && onCellClick) { const date = new Date(year, month, day); onCellClick(date, rect); } }} className="text-sm text-blue-500 pl-1 cursor-pointer hover:text-blue-700 hover:underline">+{pmBookings.length - 2}件</div>
              )}
            </div>
          </div>
        </div>,
      );
    }

    return days;
  };

  return (
      <div ref={cardRef} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col" style={cardHeight ? { height: `${cardHeight}px` } : undefined}>
        {/* Header with month nav + sub-view toggle */}
        <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-[var(--md-outline)]">
          <div className="flex items-center gap-2">
            {modeToggle}
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              {year}年 {month + 1}月
              {loading && <span className="w-4 h-4 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />}
            </h2>
            <div className="flex gap-1">
              <button onClick={onPrevMonth} className="p-2 hover:bg-[var(--md-surface-1)] rounded-full transition-colors">
                <ChevronLeft size={20} className="text-[var(--md-on-surface-variant)]" />
              </button>
              <button onClick={onNextMonth} className="p-2 hover:bg-[var(--md-surface-1)] rounded-full transition-colors">
                <ChevronRight size={20} className="text-[var(--md-on-surface-variant)]" />
              </button>
            </div>
            {subTitle && <span className="text-xs text-gray-500 ml-1">{subTitle}</span>}
          </div>

          {/* Month / Week / List toggle */}
          <div className="flex items-center bg-gray-100 rounded-full p-0.5">
            {(['month', 'week', 'list'] as const).map(v => (
              <button key={v} onClick={() => setSubView(v)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                  subView === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v === 'month' ? '月' : v === 'week' ? '週' : '一覧'}
              </button>
            ))}
          </div>
        </div>


        {subView === 'month' ? (
          <>
            {/* Weekday header */}
            <div className="grid grid-cols-7 text-center bg-gray-50 border-b border-gray-200 shrink-0">
              {weekDays.map((d, i) => (
                <div key={d} className={`py-1 text-sm font-bold ${i === 6 ? 'text-red-500' : i === 5 ? 'text-blue-500' : 'text-gray-600'}`}>
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 flex-1" style={{ gridAutoRows: '1fr' }}>
              {generateCalendarDays()}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 px-3 py-1.5 border-t border-gray-100 text-sm text-gray-700 items-center shrink-0">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-white border border-gray-200 rounded" />午前</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-gray-100 rounded" />午後</span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-yellow-400 rounded-full" />会議室</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-sky-400 rounded-full" />和室</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-pink-400 rounded-full" />図書室</span>
            </div>
          </>
        ) : subView === 'list' ? (
          <BookingSheetView
            bookings={bookings}
            year={year}
            month={month}
            holidays={holidays}
            onItemClick={onItemClick}
            onEditClick={onEditBookingClick}
            onRefresh={onRefreshBookings}
          />
        ) : (
          <div className="p-4">
            <CalendarWeeklyView
              weekStart={weekStart}
              bookings={bookings}
              onPrevWeek={() => setWeekStart(prev => {
                const d = new Date(prev);
                d.setDate(d.getDate() - 7);
                return d;
              })}
              onNextWeek={() => setWeekStart(prev => {
                const d = new Date(prev);
                d.setDate(d.getDate() + 7);
                return d;
              })}
              holidays={holidays}
              onItemClick={onItemClick}
            />
          </div>
        )}

        {/* 個別アイテム詳細ポップオーバー（ユーザー側） */}
        {itemDetail && (() => {
          const b = itemDetail.booking;
          const d = new Date(b.date + 'T00:00:00');
          const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
          const colors = ROOM_COLORS[b.room] || { bar: 'bg-gray-400' };
          const slotLabel = b.startTime === '09:00' ? '午前' : b.startTime === '13:00' ? '午後' : '夜間';
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          let left = itemDetail.anchor.left + itemDetail.anchor.width + 8;
          if (left + 300 > vw - 16) left = itemDetail.anchor.left - 300 - 8;
          if (left < 16) left = 16;
          let top = itemDetail.anchor.top;
          if (top + 200 > vh - 16) top = vh - 200 - 16;
          if (top < 16) top = 16;
          return (
            <>
              <div className="fixed inset-0 z-40" onClick={() => { setItemDetail(null); setSelectedBookingId(null); }} />
              <div className="bg-emerald-50 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] border border-emerald-200 overflow-hidden" style={{ position: 'fixed', left, top, zIndex: 50, width: 300 }}>
                <div className="flex items-center justify-end px-3 pt-2">
                  <button onClick={() => { setItemDetail(null); setSelectedBookingId(null); }} className="p-1 hover:bg-emerald-100 rounded-full">
                    <X size={14} className="text-emerald-500" />
                  </button>
                </div>
                <div className="px-4 pb-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`${colors.bar} w-3 h-3 rounded-sm shrink-0`} />
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{b.title}</h3>
                      <p className="text-xs text-gray-500">{d.getMonth() + 1}月{d.getDate()}日 ({dow})</p>
                    </div>
                  </div>
                  {itemDetail.orgName && (
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <Users size={14} className="text-emerald-500" />
                      <span>{itemDetail.orgName}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Clock size={14} className="text-emerald-500" />
                    <span>{slotLabel} {b.startTime}〜{b.endTime}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <MapPin size={14} className="text-emerald-500" />
                    <span>{shortRoomName(b.room)}</span>
                  </div>
                  {itemDetail.memo && (
                    <div className="flex items-start gap-3 text-sm text-gray-600">
                      <AlignLeft size={14} className="text-emerald-500 mt-0.5" />
                      <span className="whitespace-pre-wrap">{itemDetail.memo}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          );
        })()}
      </div>
  );
};

export default BookingCalendar;
