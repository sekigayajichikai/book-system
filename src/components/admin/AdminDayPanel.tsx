import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Booking, RoomType } from '../../types';
import { ROOMS, TIME_SLOTS, shortRoomName } from '../../constants';

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface AdminDayPanelProps {
  date: Date;
  bookings: Booking[];
  onClose: () => void;
  onRefresh: () => void;
}

export default function AdminDayPanel({ date, bookings, onClose, onRefresh }: AdminDayPanelProps) {
  const dateStr = formatDate(date);
  const dow = date.getDay();
  const dayBookings = bookings.filter(b => b.date === dateStr);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ slot: '午前', room: ROOMS[0].id as string, title: '' });

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`「${title}」を削除しますか？`)) return;
    await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal',
      },
    });
    onRefresh();
  };

  const handleAdd = async () => {
    if (!addForm.title.trim()) return alert('タイトルを入力してください');
    const slot = TIME_SLOTS.find(s => s.gasKey === addForm.slot);
    await fetch('/api/booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: dateStr,
        slot: addForm.slot,
        room: addForm.room,
        title: addForm.title.trim(),
      }),
    });
    setShowAddForm(false);
    setAddForm({ slot: '午前', room: ROOMS[0].id as string, title: '' });
    onRefresh();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-bold text-gray-800">
            {date.getMonth() + 1}月{date.getDate()}日({DOW[dow]})
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700"
            >
              <Plus size={14} /> 追加
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-full">
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="p-4 border-b border-gray-200 bg-emerald-50 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">時間帯</label>
                <select value={addForm.slot} onChange={e => setAddForm(f => ({ ...f, slot: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {TIME_SLOTS.map(s => <option key={s.id} value={s.gasKey}>{s.gasKey} {s.startTime}〜{s.endTime}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">部屋</label>
                <select value={addForm.room} onChange={e => setAddForm(f => ({ ...f, room: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  {ROOMS.map(r => <option key={r.id} value={r.id}>{r.shortName}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">タイトル</label>
              <input value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="団体名やイベント名" autoFocus />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAddForm(false)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-600">キャンセル</button>
              <button onClick={handleAdd} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700">登録</button>
            </div>
          </div>
        )}

        {/* Bookings list */}
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
                      <div key={b.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg mb-1">
                        <div>
                          <span className="text-sm font-medium text-gray-800">{b.title}</span>
                          <span className="text-xs text-gray-400 ml-2">{shortRoomName(b.room)}</span>
                        </div>
                        <button onClick={() => handleDelete(b.id, b.title)} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 size={14} />
                        </button>
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
