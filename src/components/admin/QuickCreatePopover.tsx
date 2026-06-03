import { useState, useEffect } from 'react';
import { Clock, MapPin, Users, AlignLeft, Star, X } from 'lucide-react';
import Popover from './Popover';
import OrgPicker from './OrgPicker';
import { ROOMS, TIME_SLOTS } from '../../constants';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

/** 15分刻みの時間選択肢を生成 (07:00〜21:00) */
const TIME_OPTIONS: string[] = [];
for (let h = 7; h <= 21; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface IconFieldProps {
  icon: React.ReactNode;
  children: React.ReactNode;
}

function IconField({ icon, children }: IconFieldProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="pt-2.5 text-gray-400 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ======== 予定作成 (カレンダータブ) ========

interface EventCreateProps {
  date: Date;
  onClose: () => void;
  onSaved: () => void;
  onClosureChange?: () => void;
  isClosure?: boolean;
  anchorRect: { top: number; left: number; width: number; height: number };
}

export function EventCreatePopover({ date, onClose, onSaved, onClosureChange, isClosure, anchorRect }: EventCreateProps) {
  const dateStr = formatDateStr(date);
  const dateLabel = `${date.getMonth() + 1}月${date.getDate()}日 (${DOW[date.getDay()]})`;
  const [locations, setLocations] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: '', org: '', start_time: '', end_time: '',
    location: '', description: '', is_major: false,
  });
  const [allDay, setAllDay] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supaFetch('event_locations?order=sort_order.asc&select=name')
      .then(r => r.json()).then(d => setLocations((d || []).map((l: any) => l.name)));
  }, []);

  const handleSave = async () => {
    if (!form.title.trim()) return alert('タイトルを入力してください');
    setSaving(true);
    const title = form.org ? `${form.title.trim()}` : form.title.trim();
    await supaFetch('calendar_events', {
      method: 'POST',
      body: JSON.stringify({
        date: dateStr,
        title,
        location: form.location || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        memo: form.org || null,
        description: form.description || null,
        event_type: 'general',
        visibility: 'public',
        is_major: form.is_major,
      }),
    });
    setSaving(false);
    onClose();
    onSaved();
  };

  return (
    <Popover anchorRect={anchorRect} onClose={onClose}>
      <div className="p-4 space-y-3">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">予定を作成</span>
          <div className="flex items-center gap-1">
            <button
              onClick={async () => {
                if (isClosure) {
                  await supaFetch(`calendar_events?date=eq.${dateStr}&is_closure=eq.true`, {
                    method: 'DELETE', headers: { 'Prefer': 'return=minimal' },
                  });
                } else {
                  await supaFetch('calendar_events', {
                    method: 'POST',
                    body: JSON.stringify({ date: dateStr, title: '休館日', is_closure: true, event_type: 'closure' }),
                  });
                }
                onClosureChange?.();
                onClose();
                onSaved();
              }}
              className={`text-xs px-2 py-1 rounded-lg ${isClosure ? 'text-orange-600 bg-orange-50 hover:bg-orange-100 font-bold' : 'text-gray-500 hover:text-orange-600 hover:bg-orange-50'}`}
            >
              {isClosure ? '休館を解除' : '休館にする'}
            </button>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={16} className="text-gray-400" /></button>
          </div>
        </div>

        {/* タイトル */}
        <input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          className="w-full text-lg font-medium border-0 border-b-2 border-blue-400 focus:border-blue-600 outline-none pb-1 placeholder-gray-300"
          placeholder="タイトルを追加"
          autoFocus
        />

        {/* 日時 */}
        <IconField icon={<Clock size={18} />}>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded">{dateLabel}</span>
              {allDay ? (
                <button onClick={() => setAllDay(false)}
                  className="text-sm text-blue-600 font-medium border border-gray-200 px-3 py-1 rounded-lg hover:bg-blue-50">
                  時間を追加
                </button>
              ) : (
                <>
                  <select value={form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    className="px-2 py-1 text-sm border border-gray-200 rounded-lg focus:border-blue-400 outline-none">
                    <option value="">開始</option>
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <span className="text-gray-400">-</span>
                  <select value={form.end_time}
                    onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    className="px-2 py-1 text-sm border border-gray-200 rounded-lg focus:border-blue-400 outline-none">
                    <option value="">終了</option>
                    {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </>
              )}
            </div>
            {!allDay && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={false}
                  onChange={() => { setAllDay(true); setForm(f => ({ ...f, start_time: '', end_time: '' })); }}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-blue-500 focus:ring-blue-500" />
                <span className="text-xs text-gray-500">終日</span>
              </label>
            )}
          </div>
        </IconField>

        {/* 団体 */}
        <IconField icon={<Users size={18} />}>
          <OrgPicker value={form.org} onChange={v => setForm(f => ({ ...f, org: v }))} />
        </IconField>

        {/* 場所 */}
        <IconField icon={<MapPin size={18} />}>
          <select
            value={form.location}
            onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-blue-400 outline-none"
          >
            <option value="">場所を追加</option>
            {locations.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </IconField>

        {/* 説明 */}
        <IconField icon={<AlignLeft size={18} />}>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-blue-400 outline-none resize-none"
            placeholder="説明を追加"
          />
        </IconField>

        {/* 主な予定 */}
        <label className="flex items-center gap-2 pl-9 cursor-pointer">
          <input type="checkbox" checked={form.is_major}
            onChange={e => setForm(f => ({ ...f, is_major: e.target.checked }))}
            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
          <Star size={14} className="text-orange-400" />
          <span className="text-sm text-gray-600">主な予定</span>
        </label>

        {/* 保存ボタン */}
        <div className="flex justify-end pt-1">
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-full text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
            保存
          </button>
        </div>
      </div>
    </Popover>
  );
}

// ======== 予約作成 (会館予約タブ) ========

interface BookingCreateProps {
  date: Date;
  onClose: () => void;
  onSaved: () => void;
  anchorRect: { top: number; left: number; width: number; height: number };
}

export function BookingCreatePopover({ date, onClose, onSaved, anchorRect }: BookingCreateProps) {
  const dateStr = formatDateStr(date);
  const dateLabel = `${date.getMonth() + 1}月${date.getDate()}日 (${DOW[date.getDay()]})`;
  const [form, setForm] = useState({
    org: '', title: '', slot: '午前', room: ROOMS[0].id as string, description: '',
  });
  const [saving, setSaving] = useState(false);

  // 団体名→タイトル自動設定
  const effectiveTitle = form.title || form.org;

  const handleSave = async () => {
    if (!effectiveTitle.trim()) return alert('団体名またはタイトルを入力してください');
    setSaving(true);

    // calendar_events に同日同タイトルがあるか確認
    const existRes = await supaFetch(
      `calendar_events?date=eq.${dateStr}&title=eq.${encodeURIComponent(effectiveTitle.trim())}&event_type=eq.facility&select=id&limit=1`
    );
    const existing = existRes.ok ? await existRes.json() : [];
    let eventId: string;

    if (existing.length > 0) {
      eventId = existing[0].id;
    } else {
      const evRes = await supaFetch('calendar_events', {
        method: 'POST',
        body: JSON.stringify({
          date: dateStr,
          title: effectiveTitle.trim(),
          event_type: 'facility',
          visibility: 'public',
          location: '自治会館',
        }),
      });
      const evData = await evRes.json();
      eventId = evData[0]?.id;
    }

    // booking作成
    const bookRes = await supaFetch('bookings', {
      method: 'POST',
      body: JSON.stringify({
        date: dateStr,
        slot: form.slot,
        room: form.room,
        title: effectiveTitle.trim(),
        status: 'CONFIRMED',
        event_id: eventId,
        memo: form.description || null,
      }),
    });

    if (!bookRes.ok) {
      const err = await bookRes.text();
      if (err.includes('23505')) {
        alert('この時間帯・部屋は既に予約されています');
      } else {
        alert('保存に失敗しました');
      }
      setSaving(false);
      return;
    }

    setSaving(false);
    onClose();
    onSaved();
  };

  return (
    <Popover anchorRect={anchorRect} onClose={onClose}>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">予約を作成</span>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={16} className="text-gray-400" /></button>
        </div>
        <IconField icon={<Users size={18} />}>
          <OrgPicker value={form.org} onChange={v => setForm(f => ({ ...f, org: v }))} />
        </IconField>
        <div className="pl-9">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-emerald-400 outline-none"
            placeholder={form.org ? `${form.org}（自動設定）` : 'タイトル（空欄で団体名を使用）'} />
        </div>
        <div className="text-sm text-gray-500 pl-9">{dateLabel}</div>
        <IconField icon={<Clock size={18} />}>
          <select value={form.slot} onChange={e => setForm(f => ({ ...f, slot: e.target.value }))}
            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-emerald-400 outline-none">
            {TIME_SLOTS.map(s => <option key={s.id} value={s.gasKey}>{s.gasKey} {s.startTime}〜{s.endTime}</option>)}
          </select>
        </IconField>
        <IconField icon={<MapPin size={18} />}>
          <select value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))}
            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-emerald-400 outline-none">
            {ROOMS.map(r => <option key={r.id} value={r.id}>{r.shortName}</option>)}
          </select>
        </IconField>
        <IconField icon={<AlignLeft size={18} />}>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2} className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:border-emerald-400 outline-none resize-none"
            placeholder="説明を追加" />
        </IconField>
        <div className="flex justify-end pt-1">
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 bg-emerald-600 text-white rounded-full text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">保存</button>
        </div>
      </div>
    </Popover>
  );
}
