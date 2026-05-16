import { useState } from 'react';
import { Plus, Trash2, Pencil, X, CalendarPlus, Check } from 'lucide-react';
import { Booking } from '../../types';
import { ROOMS, TIME_SLOTS, shortRoomName } from '../../constants';

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function supaFetch(path: string, options?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options?.headers || {}),
    },
  });
}

interface AdminDayPanelProps {
  date: Date;
  bookings: Booking[];
  isClosure?: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onClosureChange?: () => void;
}

type FormMode = 'none' | 'add-booking' | 'add-event' | 'edit';

export default function AdminDayPanel({ date, bookings, isClosure, onClose, onRefresh, onClosureChange }: AdminDayPanelProps) {
  const dateStr = formatDate(date);
  const dow = date.getDay();
  const dayBookings = bookings.filter(b => b.date === dateStr);

  const [formMode, setFormMode] = useState<FormMode>('none');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ slot: '午前', room: ROOMS[0].id as string, title: '' });
  const [eventForm, setEventForm] = useState({ title: '', location: '', start_time: '', end_time: '', memo: '' });

  const resetForm = () => {
    setFormMode('none');
    setEditId(null);
    setForm({ slot: '午前', room: ROOMS[0].id as string, title: '' });
    setEventForm({ title: '', location: '', start_time: '', end_time: '', memo: '' });
  };

  // 予約追加
  const handleAddBooking = async () => {
    if (!form.title.trim()) return alert('タイトルを入力してください');
    await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateStr, slot: form.slot, room: form.room, title: form.title.trim() }),
    });
    resetForm();
    onRefresh();
  };

  // 予約編集
  const startEdit = (b: Booking) => {
    const slot = TIME_SLOTS.find(s => s.startTime === b.startTime);
    setEditId(b.id);
    setForm({ slot: slot?.gasKey || '午前', room: b.room, title: b.title });
    setFormMode('edit');
  };

  const handleSaveEdit = async () => {
    if (!editId || !form.title.trim()) return;
    const res = await supaFetch(`bookings?id=eq.${editId}`, {
      method: 'PATCH',
      body: JSON.stringify({ slot: form.slot, room: form.room, title: form.title.trim() }),
    });
    if (!res.ok) {
      const err = await res.text();
      alert('保存に失敗しました: ' + (err.includes('23505') ? 'この時間帯・部屋は既に予約されています' : err));
      return;
    }
    resetForm();
    onRefresh();
  };

  // 予約削除
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`「${title}」を削除しますか？`)) return;
    await supaFetch(`bookings?id=eq.${id}`, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
    onRefresh();
  };

  // カレンダーイベント追加
  const handleAddEvent = async () => {
    if (!eventForm.title.trim()) return alert('タイトルを入力してください');
    await supaFetch('calendar_events', {
      method: 'POST',
      body: JSON.stringify({
        date: dateStr,
        title: eventForm.title.trim(),
        location: eventForm.location || null,
        start_time: eventForm.start_time || null,
        end_time: eventForm.end_time || null,
        memo: eventForm.memo || null,
      }),
    });
    resetForm();
    onRefresh();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-800">
              {date.getMonth() + 1}月{date.getDate()}日({DOW[dow]})
            </h3>
            {isClosure && <span className="text-xs bg-orange-400 text-white px-2 py-0.5 rounded font-bold">休館</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={async () => {
                if (isClosure) {
                  await supaFetch(`calendar_events?date=eq.${dateStr}&is_closure=eq.true`, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
                } else {
                  await supaFetch('calendar_events', { method: 'POST', body: JSON.stringify({ date: dateStr, title: '休館日', is_closure: true }) });
                }
                onClosureChange?.();
              }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold ${isClosure ? 'bg-orange-100 text-orange-600 hover:bg-orange-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            >
              {isClosure ? '休館解除' : '休館にする'}
            </button>
            <button
              onClick={() => { resetForm(); setFormMode('add-booking'); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
            >
              <Plus size={14} /> 予約
            </button>
            <button
              onClick={() => { resetForm(); setFormMode('add-event'); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
            >
              <CalendarPlus size={14} /> 予定
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-full">
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* 予約追加/編集フォーム */}
        {(formMode === 'add-booking' || formMode === 'edit') && (
          <div className="p-4 border-b border-gray-200 bg-emerald-50 space-y-3">
            <div className="text-xs font-bold text-emerald-700 mb-1">
              {formMode === 'edit' ? '予約を編集' : '予約を追加'}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">時間帯</label>
                <select value={form.slot} onChange={e => setForm(f => ({ ...f, slot: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {TIME_SLOTS.map(s => <option key={s.id} value={s.gasKey}>{s.gasKey} {s.startTime}〜{s.endTime}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">部屋</label>
                <select value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {ROOMS.map(r => <option key={r.id} value={r.id}>{r.shortName}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">タイトル</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="団体名やイベント名" autoFocus />
            </div>
            <div className="flex gap-2">
              <button onClick={resetForm} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-600">キャンセル</button>
              <button onClick={formMode === 'edit' ? handleSaveEdit : handleAddBooking} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">
                {formMode === 'edit' ? '更新' : '登録'}
              </button>
            </div>
          </div>
        )}

        {/* カレンダー予定追加フォーム */}
        {formMode === 'add-event' && (
          <div className="p-4 border-b border-gray-200 bg-blue-50 space-y-3">
            <div className="text-xs font-bold text-blue-700 mb-1">カレンダー予定を追加</div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">タイトル</label>
              <input value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="夏祭り、防災訓練など" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">場所</label>
              <input value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="自治会館 / 公園 / その他" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">開始</label>
                <input type="time" value={eventForm.start_time} onChange={e => setEventForm(f => ({ ...f, start_time: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">終了</label>
                <input type="time" value={eventForm.end_time} onChange={e => setEventForm(f => ({ ...f, end_time: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">メモ</label>
              <input value={eventForm.memo} onChange={e => setEventForm(f => ({ ...f, memo: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="補足情報" />
            </div>
            <div className="flex gap-2">
              <button onClick={resetForm} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-600">キャンセル</button>
              <button onClick={handleAddEvent} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">登録</button>
            </div>
          </div>
        )}

        {/* 予約一覧 */}
        <div className="flex-1 overflow-auto p-4">
          {dayBookings.length === 0 ? (
            <p className="text-gray-300 text-sm text-center py-8">この日の予約はありません</p>
          ) : (
            <div className="space-y-2">
              {TIME_SLOTS.map(slot => {
                const slotBookings = dayBookings.filter(b => b.startTime === slot.startTime);
                if (slotBookings.length === 0) return null;
                return (
                  <div key={slot.id}>
                    <div className="text-xs font-bold text-gray-500 mb-1">{slot.gasKey} {slot.startTime}〜{slot.endTime}</div>
                    {slotBookings.map(b => (
                      <div key={b.id} className={`flex items-center justify-between py-2 px-3 rounded-lg mb-1 ${editId === b.id ? 'bg-emerald-50 ring-1 ring-emerald-300' : 'bg-gray-50'}`}>
                        <div>
                          <span className="text-sm font-medium text-gray-800">{b.title}</span>
                          <span className="text-xs text-gray-400 ml-2">{shortRoomName(b.room)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => startEdit(b)} className="text-blue-400 hover:text-blue-600 p-1"><Pencil size={14} /></button>
                          <button onClick={() => handleDelete(b.id, b.title)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
