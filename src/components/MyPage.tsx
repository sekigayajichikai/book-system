import { useState, useEffect } from 'react';
import { shortRoomName } from '../constants';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  CONFIRMED: { text: '確定', cls: 'bg-emerald-100 text-emerald-700' },
  PENDING: { text: '承認待ち', cls: 'bg-yellow-100 text-yellow-700' },
  REJECTED: { text: '却下', cls: 'bg-red-100 text-red-600' },
  CANCELLED: { text: 'キャンセル', cls: 'bg-gray-100 text-gray-500' },
};

interface MyPageProps {
  orgId: string;
  orgName: string;
}

export default function MyPage({ orgId, orgName }: MyPageProps) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${SUPABASE_URL}/rest/v1/bookings?org_id=eq.${orgId}&order=date.desc&select=*`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    })
      .then(r => r.json())
      .then(data => setBookings(data || []))
      .finally(() => setLoading(false));
  }, [orgId]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-800">{orgName} の申請一覧</h2>

      {loading ? (
        <p className="text-gray-400 text-sm">読み込み中...</p>
      ) : bookings.length === 0 ? (
        <p className="text-gray-400 text-sm">申請はまだありません</p>
      ) : (
        <div className="space-y-2">
          {bookings.map((b: any) => {
            const st = STATUS_LABEL[b.status] || STATUS_LABEL.CANCELLED;
            return (
              <div key={b.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-gray-800">{b.date} {b.slot}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${st.cls}`}>{st.text}</span>
                </div>
                <div className="text-sm text-gray-600">
                  {shortRoomName(b.room)} — {b.title}
                </div>
                {b.reject_reason && (
                  <div className="mt-2 text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                    却下理由: {b.reject_reason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
