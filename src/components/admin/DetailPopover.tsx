import { useState, useEffect } from 'react';
import { Pencil, Trash2, X, Clock, MapPin, Users, AlignLeft, Star, Check, Type } from 'lucide-react';
import Popover from './Popover';
import OrgPicker from './OrgPicker';
import { ROOMS, TIME_SLOTS } from '../../constants';
import { SUPABASE_URL, SUPABASE_ANON_KEY as SUPABASE_KEY, supaWrite, writeErrorMessage } from '../../lib/supabase';
import { fetchRows, saveToTrash } from '../../lib/trash';

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

// 書き込みは src/lib/supabase.ts の supaWrite を通す（ログイン済みの資格で届き、断られたら例外になる）。
// 以前はここで公開鍵の Authorization を上書きしていた箇所があり、行の保護（RLS）を入れてからは
// 「主な予定」「時間」「カレンダー用タイトル」の変更が黙って弾かれていた。

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
  orgName?: string | null;
  description?: string | null;
  eventType?: string;
  fromCircular?: boolean;
  isMajor?: boolean;
  displayTitle?: string | null;
  rooms?: string[];
  // booking fields
  room?: string;
  slot?: string;
}

interface DetailPopoverProps {
  anchorRect: { top: number; left: number; width: number; height: number };
  data: DetailData;
  onClose: () => void;
  onEdit?: (data: DetailData) => void;
  onRefresh: () => void;
  onSwitchToFacility?: (eventId: string, date: string) => void;
  initialEditing?: boolean;
}

export default function DetailPopover({ anchorRect, data, onClose, onEdit, onRefresh, onSwitchToFacility, initialEditing }: DetailPopoverProps) {
  const d = new Date(data.date + 'T00:00:00');
  const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日 (${DOW[d.getDay()]})`;
  // 場所マスタ
  const [locationOptions, setLocationOptions] = useState<string[]>([]);
  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/event_locations?order=sort_order.asc&select=name`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    }).then(r => r.json()).then(d => setLocationOptions((d || []).map((l: any) => l.name))).catch(() => {});
  }, []);

  // ローカルstate（即反映用）
  const [localDisplayTitle, setLocalDisplayTitle] = useState(data.displayTitle);
  const [localStartTime, setLocalStartTime] = useState(data.startTime);
  const [localEndTime, setLocalEndTime] = useState(data.endTime);

  const [editingDisplayTitle, setEditingDisplayTitle] = useState(false);
  const [displayTitleValue, setDisplayTitleValue] = useState('');
  const [editingTime, setEditingTime] = useState(false);
  const [timeStart, setTimeStart] = useState('');
  const [timeEnd, setTimeEnd] = useState('');
  const [localDescription, setLocalDescription] = useState(data.description);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState('');

  // facility型: booking経由で団体名を取得
  const [facilityOrgName, setFacilityOrgName] = useState<string | null>(null);
  useState(() => {
    if (data.type === 'event' && data.eventType === 'facility' && !data.orgName) {
      fetch(`${SUPABASE_URL}/rest/v1/bookings?event_id=eq.${data.id}&status=in.(CONFIRMED,PENDING)&select=booking_organizations(name)&limit=1`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      }).then(r => r.json()).then(d => {
        if (d[0]?.booking_organizations?.name) setFacilityOrgName(d[0].booking_organizations.name);
      }).catch(() => {});
    }
  });

  // インライン編集（booking型は常に編集モード）
  const [editing, setEditing] = useState(initialEditing || data.type === 'booking');
  const [editForm, setEditForm] = useState({
    title: data.title,
    description: data.description || '',
    location: data.location || '',
    startTime: data.startTime || '',
    endTime: data.endTime || '',
    isMajor: data.isMajor || false,
    memo: data.orgName || '',
  });
  // booking編集用
  const [bookingForm, setBookingForm] = useState({
    title: data.title,
    org: data.orgName || '',
    slot: data.slot || '午前',
    room: data.room || '',
    memo: '',
  });

  const handleSaveTime = async () => {
    const s = timeStart || null;
    const e = timeEnd || null;
    const prev = [localStartTime, localEndTime];
    setLocalStartTime(s);
    setLocalEndTime(e);
    setEditingTime(false);
    try {
      await supaWrite(`calendar_events?id=eq.${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ start_time: s, end_time: e }),
      });
    } catch (err) {
      setLocalStartTime(prev[0]);
      setLocalEndTime(prev[1]);
      return alert(`時間を保存できませんでした。\n${writeErrorMessage(err)}`);
    }
    onRefresh();
  };

  const handleSaveDisplayTitle = async () => {
    const val = displayTitleValue.trim() || null;
    const prev = localDisplayTitle;
    setLocalDisplayTitle(val);
    setEditingDisplayTitle(false);
    try {
      await supaWrite(`calendar_events?id=eq.${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ display_title: val }),
      });
    } catch (err) {
      setLocalDisplayTitle(prev);
      return alert(`カレンダー用タイトルを保存できませんでした。\n${writeErrorMessage(err)}`);
    }
    onRefresh();
  };

  const handleSaveDescription = async () => {
    const val = descriptionValue.trim() || null;
    const prev = localDescription;
    setLocalDescription(val);
    setEditingDescription(false);
    try {
      await supaWrite(`calendar_events?id=eq.${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ description: val }),
      });
    } catch (err) {
      setLocalDescription(prev);
      return alert(`説明を保存できませんでした。\n${writeErrorMessage(err)}`);
    }
    onRefresh();
  };

  const handleSaveBooking = async () => {
    if (!bookingForm.title.trim()) return;
    // 団体名からorg_idを検索
    let orgId: string | null = null;
    if (bookingForm.org.trim()) {
      try {
        const orgRes = await fetch(`${SUPABASE_URL}/rest/v1/booking_organizations?name=eq.${encodeURIComponent(bookingForm.org.trim())}&select=id&limit=1`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        });
        const d = orgRes.ok ? await orgRes.json() : [];
        orgId = d[0]?.id || null;
      } catch {}
    }
    try {
      await supaWrite(`bookings?id=eq.${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: bookingForm.title.trim(),
          slot: bookingForm.slot,
          room: bookingForm.room,
          memo: bookingForm.memo.trim() || null,
          org_id: orgId,
        }),
      });
    } catch (err) {
      return alert(writeErrorMessage(err));
    }
    // calendar_eventsのorg_nameにも団体名を同期
    try {
      const evRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${data.id}&select=event_id`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      });
      const evData = evRes.ok ? await evRes.json() : [];
      if (evData[0]?.event_id) {
        await supaWrite(`calendar_events?id=eq.${evData[0].event_id}`, {
          method: 'PATCH', body: JSON.stringify({ org_name: bookingForm.org.trim() || null }),
        });
      }
    } catch {
      alert('予約は保存しましたが、カレンダー側の団体名を更新できませんでした。予定を開いて団体名を確かめてください。');
    }
    setEditing(false);
    onClose();
    onRefresh();
  };

  const handleSaveEdit = async () => {
    if (!editForm.title.trim()) return;
    // 団体名からorg_idを検索
    let orgId: string | null = null;
    const memoTrimmed = editForm.memo.trim();
    if (memoTrimmed) {
      try {
        const orgRes = await fetch(`${SUPABASE_URL}/rest/v1/booking_organizations?name=eq.${encodeURIComponent(memoTrimmed)}&select=id&limit=1`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        });
        const d = orgRes.ok ? await orgRes.json() : [];
        orgId = d[0]?.id || null;
      } catch {}
    }
    try {
      await supaWrite(`calendar_events?id=eq.${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          location: editForm.location || null,
          start_time: editForm.startTime || null,
          end_time: editForm.endTime || null,
          is_major: editForm.isMajor,
          org_name: memoTrimmed || null,
          org_id: orgId,
        }),
      });
    } catch (err) {
      return alert(writeErrorMessage(err));
    }
    setEditing(false);
    onClose();
    onRefresh();
  };

  const handleDelete = async () => {
    if (!confirm(`「${data.title}」を削除しますか？\n間違えたときは、回覧板の管理画面の「ゴミ箱」から元に戻せます。`)) return;

    try {
      await deleteTarget();
    } catch (err) {
      return alert(`削除できませんでした。\n${writeErrorMessage(err)}`);
    }
    onClose();
    onRefresh();
  };

  const deleteTarget = async () => {
    // 消す前に控えをゴミ箱へ（回覧板ポータルの管理画面から元に戻せる）
    const label = `${dateLabel} ${data.title}${data.room ? `（${data.slot ?? ''} ${data.room}）` : ''}`;
    if (data.type === 'event') {
      const eventRows = await fetchRows('calendar_events', `id=eq.${data.id}`);
      await saveToTrash('calendar_event', label, [{ table: 'calendar_events', rows: eventRows }]);
      await supaWrite(`calendar_events?id=eq.${data.id}`, { method: 'DELETE' });
    } else {
      // booking: event_idを取得して孤立イベントも削除
      const bookingRows = await fetchRows('bookings', `id=eq.${data.id}`);
      const eventId = bookingRows[0]?.event_id as string | undefined;
      // 予定も一緒に消える場合に備えて、予定を先に入れ直す順で控える（残っていれば戻すときに飛ばされる）
      const eventRows = eventId ? await fetchRows('calendar_events', `id=eq.${eventId}`) : [];
      await saveToTrash('booking', label, [
        { table: 'calendar_events', rows: eventRows },
        { table: 'bookings', rows: bookingRows },
      ]);

      await supaWrite(`bookings?id=eq.${data.id}`, { method: 'DELETE' });

      if (eventId) {
        const remRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?event_id=eq.${eventId}&status=in.(CONFIRMED,PENDING)&select=id&limit=1`, {
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
        });
        const remaining = remRes.ok ? await remRes.json() : [1];
        if (remaining.length === 0) {
          await supaWrite(`calendar_events?id=eq.${eventId}`, { method: 'DELETE' });
        }
      }
    }
  };

  // 時間表示（ローカルstate優先）
  const effectiveStartTime = data.type === 'event' ? localStartTime : data.startTime;
  const effectiveEndTime = data.type === 'event' ? localEndTime : data.endTime;
  const trimTime = (t: string | null | undefined) => t ? t.slice(0, 5) : '';
  let timeLabel = '';
  if (data.type === 'booking' && data.slot) {
    timeLabel = data.slot;
    if (data.startTime) timeLabel += ` ${trimTime(data.startTime)}`;
    if (data.endTime) timeLabel += `〜${trimTime(data.endTime)}`;
  } else if (effectiveStartTime) {
    timeLabel = trimTime(effectiveStartTime);
    if (effectiveEndTime) timeLabel += `〜${trimTime(effectiveEndTime)}`;
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
  const isBooking = data.type === 'booking';

  return (
    <Popover anchorRect={anchorRect} onClose={onClose} width={340}>
      {/* ヘッダーアクション */}
      <div className="flex items-center justify-end gap-1 px-3 pt-3 pb-1">
        {data.type === 'event' && (
          <button onClick={async () => {
            try {
              await supaWrite(`calendar_events?id=eq.${data.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ is_major: !data.isMajor }),
              });
            } catch (err) {
              return alert(writeErrorMessage(err));
            }
            onClose();
            onRefresh();
          }} className="p-1.5 hover:bg-gray-100 rounded-full" title={data.isMajor ? '主な予定を解除' : '主な予定にする'}>
            <Star size={16} className={data.isMajor ? 'text-orange-400' : 'text-gray-300'} fill={data.isMajor ? 'currentColor' : 'none'} />
          </button>
        )}
        {!isFacilityEvent && (
          <>
            {!isBooking && !initialEditing && (
              <button onClick={() => onEdit ? onEdit(data) : setEditing(!editing)} className={`p-1.5 hover:bg-gray-100 rounded-full ${editing ? 'bg-blue-100' : ''}`} title="編集">
                <Pencil size={16} className={editing ? 'text-blue-500' : 'text-gray-500'} />
              </button>
            )}
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
        {/* タイトル + タグ */}
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
        {(data.orgName || facilityOrgName) && (
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Users size={16} className="text-gray-400 flex-shrink-0" />
            <span>{data.orgName || facilityOrgName}</span>
          </div>
        )}

        {/* タイプバッジ */}
        {(data.type === 'event' || data.isMajor) && (
          <div className="flex items-center gap-2 flex-wrap">
            {data.type === 'event' && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                data.eventType === 'facility'
                  ? 'bg-violet-100 text-violet-700'
                  : data.fromCircular
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'
              }`}>
                {data.eventType === 'facility' ? '会館予約から自動作成' : data.fromCircular ? '回覧板から' : '手入力'}
              </span>
            )}
            {data.isMajor && (
              <span className="flex items-center gap-0.5 text-xs text-orange-500">
                <Star size={12} fill="currentColor" /> 主な予定
              </span>
            )}
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

        {/* 説明 */}
        {data.description && (
          <div className="flex items-start gap-3 text-sm text-gray-600">
            <AlignLeft size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
            <span className="whitespace-pre-wrap">{data.description}</span>
          </div>
        )}
        {/* 一般イベント インライン編集 */}
        {editing && !isFacilityEvent && data.type === 'event' && (
          <div className="space-y-3 border-t border-gray-200 pt-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">団体</label>
              <OrgPicker value={editForm.memo} onChange={v => setEditForm(f => ({ ...f, memo: v }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">タイトル</label>
              <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">説明</label>
              <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400" rows={3} placeholder="補足情報" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">場所</label>
              <select value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400 bg-white">
                <option value="">-- 選択 --</option>
                {locationOptions.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">開始</label>
                <select value={editForm.startTime} onChange={e => setEditForm(f => ({ ...f, startTime: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400">
                  <option value="">--</option>
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">終了</label>
                <select value={editForm.endTime} onChange={e => setEditForm(f => ({ ...f, endTime: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-400">
                  <option value="">--</option>
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editForm.isMajor} onChange={e => setEditForm(f => ({ ...f, isMajor: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
              <span className="text-sm text-gray-700">主な予定</span>
            </label>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 py-1.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50">キャンセル</button>
              <button onClick={handleSaveEdit} className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">保存</button>
            </div>
          </div>
        )}

        {/* booking インライン編集 */}
        {editing && data.type === 'booking' && (
          <div className="space-y-3 border-t border-emerald-200 pt-3">
            <div className="flex items-start gap-2.5">
              <Users size={18} className="text-gray-400 mt-2 shrink-0" />
              <OrgPicker value={bookingForm.org} onChange={v => setBookingForm(f => ({ ...f, org: v }))} className="flex-1" bookingOnly />
            </div>
            <div className="pl-9">
              <input value={bookingForm.title} onChange={e => setBookingForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-emerald-400 outline-none"
                placeholder={bookingForm.org ? `${bookingForm.org}（自動設定）` : 'タイトル（空欄で団体名を使用）'} />
            </div>
            <div className="flex items-start gap-2.5">
              <Clock size={18} className="text-gray-400 mt-2 shrink-0" />
              <select value={bookingForm.slot} onChange={e => setBookingForm(f => ({ ...f, slot: e.target.value }))}
                className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-emerald-400 outline-none">
                {TIME_SLOTS.map(s => <option key={s.id} value={s.gasKey}>{s.gasKey} {s.startTime}〜{s.endTime}</option>)}
              </select>
            </div>
            <div className="flex items-start gap-2.5">
              <MapPin size={18} className="text-gray-400 mt-2 shrink-0" />
              <select value={bookingForm.room} onChange={e => setBookingForm(f => ({ ...f, room: e.target.value }))}
                className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-emerald-400 outline-none">
                {ROOMS.map(r => <option key={r.id} value={r.id}>{r.shortName}</option>)}
              </select>
            </div>
            <div className="flex items-start gap-2.5">
              <AlignLeft size={18} className="text-gray-400 mt-2 shrink-0" />
              <textarea value={bookingForm.memo} onChange={e => setBookingForm(f => ({ ...f, memo: e.target.value }))}
                rows={2} className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-emerald-400 outline-none resize-none"
                placeholder="説明を追加" />
            </div>
            <div className="flex justify-end pt-1">
              <button onClick={handleSaveBooking}
                className="px-6 py-2 bg-emerald-600 text-white rounded-full text-sm font-bold hover:bg-emerald-700">保存</button>
            </div>
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
        {/* 説明（facility型イベント） */}
        {isFacilityEvent && data.type === 'event' && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <AlignLeft size={12} />
              <span>説明</span>
            </div>
            {editingDescription ? (
              <div className="space-y-1.5">
                <textarea value={descriptionValue} onChange={e => setDescriptionValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setEditingDescription(false); }}
                  className="w-full px-2 py-1.5 text-sm border border-blue-300 rounded-lg focus:outline-none focus:border-blue-500"
                  autoFocus rows={3} placeholder="補足情報" />
                <button onClick={handleSaveDescription} className="w-full py-1.5 bg-blue-500 text-white rounded-lg text-sm font-bold hover:bg-blue-600">
                  <Check size={14} className="inline -mt-0.5 mr-1" />保存
                </button>
              </div>
            ) : (
              <button onClick={() => { setEditingDescription(true); setDescriptionValue(localDescription || ''); }}
                className="w-full text-left px-2 py-1.5 text-sm border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors">
                <span className={localDescription ? 'text-gray-800 whitespace-pre-wrap' : 'text-gray-400 italic'}>
                  {localDescription || '（クリックして設定）'}
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
