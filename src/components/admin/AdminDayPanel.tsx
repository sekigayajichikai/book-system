import { useState } from 'react';
import { Plus, Trash2, Pencil, X, CalendarPlus, Check, Star } from 'lucide-react';
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

interface CalEvent {
  id: string;
  title: string;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  memo: string | null;
  event_type: string;
  visibility: string;
  is_major: boolean;
}

interface AdminDayPanelProps {
  date: Date;
  bookings: Booking[];
  isClosure?: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onClosureChange?: () => void;
  mode?: 'facility' | 'schedule';
}

type FormMode = 'none' | 'add-booking' | 'add-event' | 'add-banner' | 'edit' | 'edit-event';

export default function AdminDayPanel({ date, bookings, isClosure, onClose, onRefresh, onClosureChange, mode = 'facility' }: AdminDayPanelProps) {
  const dateStr = formatDate(date);
  const dow = date.getDay();
  const dayBookings = bookings.filter(b => b.date === dateStr);

  // カレンダーモード: calendar_events を取得
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const fetchCalEvents = async () => {
    const res = await supaFetch(`calendar_events?date=eq.${dateStr}&event_type=neq.closure&order=start_time.asc`);
    if (res.ok) setCalEvents(await res.json());
  };

  useState(() => { if (mode === 'schedule') fetchCalEvents(); });

  const [formMode, setFormMode] = useState<FormMode>('none');
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ slot: '午前', room: ROOMS[0].id as string, title: '' });
  const [eventForm, setEventForm] = useState({ title: '', location: '', start_time: '', end_time: '', memo: '', is_major: false });
  const [bannerForm, setBannerForm] = useState({ title: '', description: '', event_time: '', event_location: '', style: 'green', display_days: '7', image_url: '' });

  const resetForm = () => {
    setFormMode('none');
    setEditId(null);
    setForm({ slot: '午前', room: ROOMS[0].id as string, title: '' });
    setEventForm({ title: '', location: '', start_time: '', end_time: '', memo: '', is_major: false });
    setBannerForm({ title: '', description: '', event_time: '', event_location: '', style: 'green', display_days: '7', image_url: '' });
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

  // 主な予定トグル
  const toggleMajor = async (id: string, current: boolean) => {
    await supaFetch(`calendar_events?id=eq.${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_major: !current }),
    });
    await fetchCalEvents();
    onRefresh();
  };

  // カレンダーイベント削除
  const handleDeleteEvent = async (id: string, title: string) => {
    if (!confirm(`「${title}」を削除しますか？`)) return;
    await supaFetch(`calendar_events?id=eq.${id}`, { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
    await fetchCalEvents();
    onRefresh();
  };

  // カレンダーイベント編集開始
  const startEditEvent = (ev: CalEvent) => {
    setEditingEventId(ev.id);
    setEventForm({
      title: ev.title,
      location: ev.location || '',
      start_time: ev.start_time ? ev.start_time.slice(0, 5) : '',
      end_time: ev.end_time ? ev.end_time.slice(0, 5) : '',
      memo: ev.memo || '',
      is_major: (ev as any).is_major || false,
    });
    setFormMode('edit-event');
  };

  // カレンダーイベント編集保存
  const handleSaveEventEdit = async () => {
    if (!editingEventId || !eventForm.title.trim()) return;
    await supaFetch(`calendar_events?id=eq.${editingEventId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: eventForm.title.trim(),
        location: eventForm.location || null,
        start_time: eventForm.start_time || null,
        end_time: eventForm.end_time || null,
        memo: eventForm.memo || null,
        is_major: eventForm.is_major,
      }),
    });
    setEditingEventId(null);
    resetForm();
    await fetchCalEvents();
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
        event_type: 'general',
        visibility: 'public',
        is_major: eventForm.is_major,
      }),
    });
    resetForm();
    await fetchCalEvents();
    onRefresh();
  };

  // バナー追加
  const handleAddBanner = async () => {
    if (!bannerForm.title.trim()) return alert('タイトルを入力してください');
    const displayDays = Number(bannerForm.display_days) || 7;
    const displayStart = new Date(date);
    displayStart.setDate(displayStart.getDate() - displayDays);
    await supaFetch('calendar_banners', {
      method: 'POST',
      body: JSON.stringify({
        title: bannerForm.title.trim(),
        description: bannerForm.description || null,
        event_date: dateStr,
        event_time: bannerForm.event_time || null,
        event_location: bannerForm.event_location || null,
        display_start: displayStart.toISOString().slice(0, 10),
        display_end: dateStr,
        style: bannerForm.style,
        image_url: bannerForm.image_url || null,
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
              onClick={() => { resetForm(); setFormMode('add-banner'); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700"
            >
              バナー
            </button>
            <button
              onClick={() => { resetForm(); setFormMode('add-event'); }}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
            >
              <CalendarPlus size={14} /> 予定
            </button>
            {mode === 'facility' && (
              <button
                onClick={() => { resetForm(); setFormMode('add-booking'); }}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
              >
                <Plus size={14} /> 予約
              </button>
            )}
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
        {/* バナー追加フォーム */}
        {formMode === 'add-banner' && (
          <div className="p-4 border-b border-gray-200 bg-purple-50 space-y-3">
            <div className="text-xs font-bold text-purple-700 mb-1">バナーを追加（この日のイベント告知）</div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">タイトル *</label>
              <input value={bannerForm.title} onChange={e => setBannerForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="古本市やります！" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">説明</label>
              <input value={bannerForm.description} onChange={e => setBannerForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="どなたでも参加OK" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">時間</label>
                <input value={bannerForm.event_time} onChange={e => setBannerForm(f => ({ ...f, event_time: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="10:00〜15:00" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">場所</label>
                <input value={bannerForm.event_location} onChange={e => setBannerForm(f => ({ ...f, event_location: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="会議室" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">スタイル</label>
                <select value={bannerForm.style} onChange={e => setBannerForm(f => ({ ...f, style: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="green">グリーン</option>
                  <option value="blue">ブルー</option>
                  <option value="orange">オレンジ</option>
                  <option value="pink">ピンク</option>
                  <option value="purple">パープル</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">何日前から表示</label>
                <input type="number" value={bannerForm.display_days} onChange={e => setBannerForm(f => ({ ...f, display_days: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">画像URL（任意。指定するとテンプレートの代わりに画像を表示）</label>
              <input value={bannerForm.image_url} onChange={e => setBannerForm(f => ({ ...f, image_url: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="https://..." />
            </div>
            <div className="flex gap-2">
              <button onClick={resetForm} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-600">キャンセル</button>
              <button onClick={handleAddBanner} className="flex-1 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700">登録</button>
            </div>
          </div>
        )}

        {(formMode === 'add-event' || formMode === 'edit-event') && (
          <div className="p-4 border-b border-gray-200 bg-blue-50 space-y-3">
            <div className="text-xs font-bold text-blue-700 mb-1">
              {formMode === 'edit-event' ? 'カレンダー予定を編集' : 'カレンダー予定を追加'}
            </div>
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
                <input type="time" step="900" value={eventForm.start_time} onChange={e => setEventForm(f => ({ ...f, start_time: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-base" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">終了</label>
                <input type="time" step="900" value={eventForm.end_time} onChange={e => setEventForm(f => ({ ...f, end_time: e.target.value }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-base" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">メモ</label>
              <input value={eventForm.memo} onChange={e => setEventForm(f => ({ ...f, memo: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="補足情報" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={eventForm.is_major} onChange={e => setEventForm(f => ({ ...f, is_major: e.target.checked }))} className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
              <span className="text-sm font-medium text-gray-700">主な予定</span>
              <span className="text-xs text-gray-400">（カレンダーで強調表示されます）</span>
            </label>
            <div className="flex gap-2">
              <button onClick={resetForm} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-600">キャンセル</button>
              <button onClick={formMode === 'edit-event' ? handleSaveEventEdit : handleAddEvent} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">
                {formMode === 'edit-event' ? '更新' : '登録'}
              </button>
            </div>
          </div>
        )}

        {/* 一覧: モードで切り替え */}
        <div className="flex-1 overflow-auto p-4">
          {mode === 'schedule' ? (
            /* === カレンダー予定一覧 === */
            calEvents.length === 0 ? (
              <p className="text-gray-300 text-sm text-center py-8">この日の予定はありません</p>
            ) : (
              <div className="space-y-2">
                {calEvents.map(ev => (
                  <div key={ev.id} className={`flex items-center justify-between py-2 px-3 rounded-lg mb-1 ${editingEventId === ev.id ? 'bg-blue-50 ring-1 ring-blue-300' : 'bg-gray-50'}`}>
                    <div>
                      <span className="text-sm font-medium text-gray-800">{ev.title}</span>
                      {ev.start_time && <span className="text-xs text-gray-400 ml-2">{ev.start_time.slice(0,5)}{ev.end_time ? `〜${ev.end_time.slice(0,5)}` : ''}</span>}
                      {ev.location && <span className="text-xs text-gray-400 ml-2">{ev.location}</span>}
                      <span className={`text-xs ml-2 px-1.5 py-0.5 rounded ${ev.event_type === 'facility' ? 'bg-violet-100 text-violet-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {ev.event_type === 'facility' ? '会館' : '一般'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleMajor(ev.id, ev.is_major)} className={`p-1 ${ev.is_major ? 'text-orange-400 hover:text-orange-600' : 'text-gray-300 hover:text-orange-400'}`} title={ev.is_major ? '主な予定を解除' : '主な予定にする'}>
                        <Star size={14} fill={ev.is_major ? 'currentColor' : 'none'} />
                      </button>
                      <button onClick={() => startEditEvent(ev)} className="text-blue-400 hover:text-blue-600 p-1"><Pencil size={14} /></button>
                      <button onClick={() => handleDeleteEvent(ev.id, ev.title)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* === 予約一覧（従来） === */
            dayBookings.length === 0 ? (
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
            )
          )}
        </div>
      </div>
    </div>
  );
}
