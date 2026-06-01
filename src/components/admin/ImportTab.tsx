import { useState, useEffect, useCallback } from 'react';
import { Check, X, AlertTriangle, Plus, Trash2, RefreshCw, ArrowRight } from 'lucide-react';
import { shortRoomName } from '../../constants';

interface ImportBatch {
  id: string;
  target_year: number;
  target_month: number;
  status: string;
  total_rows: number;
  stats: { add?: number; update?: number; delete?: number; skip?: number };
  created_at: string;
}

interface ImportRow {
  id: string;
  date: string;
  slot: string;
  room: string;
  title: string;
  org_guess: string | null;
  diff_type: 'add' | 'update' | 'delete' | 'skip';
  existing_booking_id: string | null;
  existing_title: string | null;
  review_status: 'pending' | 'approved' | 'rejected' | 'skipped';
  review_note: string | null;
}

const DIFF_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  add: { label: '新規', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  update: { label: '変更', bg: 'bg-amber-50', text: 'text-amber-700' },
  delete: { label: '削除', bg: 'bg-red-50', text: 'text-red-700' },
  skip: { label: 'スキップ', bg: 'bg-gray-50', text: 'text-gray-500' },
};

const DOW = ['日', '月', '火', '水', '木', '金', '土'];

export default function ImportTab() {
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'add' | 'update' | 'delete'>('all');
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchImport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/import');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setBatch(data.batch);
      setRows(data.rows || []);
    } catch (err) {
      console.error('インポートデータ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchImport(); }, [fetchImport]);

  const filteredRows = rows.filter(r => {
    if (filter === 'all') return true;
    return r.diff_type === filter;
  });

  const pendingCount = rows.filter(r => r.review_status === 'pending').length;
  const approvedCount = rows.filter(r => r.review_status === 'approved').length;

  // 行レビュー更新
  const updateRowStatus = async (rowId: string, status: 'approved' | 'rejected') => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, review_status: status } : r));
    await fetch('/api/import', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [{ id: rowId, review_status: status }] }),
    });
  };

  // 一括承認
  const approveAll = async () => {
    const targets = filteredRows.filter(r => r.review_status === 'pending');
    if (targets.length === 0) return;

    setRows(prev => prev.map(r => {
      if (targets.some(t => t.id === r.id)) return { ...r, review_status: 'approved' as const };
      return r;
    }));

    await fetch('/api/import', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: targets.map(r => ({ id: r.id, review_status: 'approved' })),
      }),
    });
  };

  // 反映
  const handleApply = async () => {
    if (!batch) return;
    if (!confirm(`承認済み ${approvedCount}件 を反映しますか？`)) return;

    setApplying(true);
    setMessage(null);
    try {
      const res = await fetch('/api/import-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_id: batch.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: 'success', text: `${data.applied}件を反映しました` });
        await fetchImport();
      } else {
        setMessage({ type: 'error', text: data.error || '反映に失敗しました' });
      }
    } catch {
      setMessage({ type: 'error', text: '反映に失敗しました' });
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <div className="text-gray-400 text-sm py-12 text-center">読み込み中...</div>;

  if (!batch) {
    return (
      <div className="text-center py-12">
        <AlertTriangle size={40} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-400 text-sm">インポートデータがありません</p>
        <p className="text-gray-300 text-xs mt-1">自治会館PCからExcelデータがアップロードされると、ここに表示されます</p>
      </div>
    );
  }

  const createdDate = new Date(batch.created_at);

  return (
    <div className="space-y-4">
      {/* バッチ情報 */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800">
              {batch.target_year}年{batch.target_month}月のインポート
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              取込日時: {createdDate.toLocaleDateString('ja-JP')} {createdDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
              {batch.status === 'applied' && <span className="ml-2 text-emerald-600 font-bold">反映済み</span>}
            </p>
          </div>
          <button onClick={fetchImport} className="p-2 hover:bg-gray-100 rounded-full" title="再読み込み">
            <RefreshCw size={16} className="text-gray-400" />
          </button>
        </div>

        {/* 統計 */}
        <div className="flex gap-3 mt-3">
          {batch.stats.add != null && batch.stats.add > 0 && (
            <span className="flex items-center gap-1 text-sm">
              <Plus size={14} className="text-emerald-500" />
              <span className="font-bold text-emerald-700">{batch.stats.add}</span>
              <span className="text-gray-400">件 新規</span>
            </span>
          )}
          {batch.stats.update != null && batch.stats.update > 0 && (
            <span className="flex items-center gap-1 text-sm">
              <ArrowRight size={14} className="text-amber-500" />
              <span className="font-bold text-amber-700">{batch.stats.update}</span>
              <span className="text-gray-400">件 変更</span>
            </span>
          )}
          {batch.stats.delete != null && batch.stats.delete > 0 && (
            <span className="flex items-center gap-1 text-sm">
              <Trash2 size={14} className="text-red-500" />
              <span className="font-bold text-red-700">{batch.stats.delete}</span>
              <span className="text-gray-400">件 削除</span>
            </span>
          )}
        </div>
      </div>

      {/* メッセージ */}
      {message && (
        <div className={`p-3 rounded-lg text-sm font-bold ${message.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* フィルタ + 一括操作 */}
      {batch.status !== 'applied' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {(['all', 'add', 'update', 'delete'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filter === f ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'all' ? '全て' : DIFF_LABELS[f].label}
                {f !== 'all' && ` (${rows.filter(r => r.diff_type === f).length})`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={approveAll}
              disabled={pendingCount === 0}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              表示中を全て承認
            </button>
          </div>
        </div>
      )}

      {/* 差分一覧 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredRows.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">
            {filter === 'all' ? '差分はありません' : `${DIFF_LABELS[filter].label}の項目はありません`}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500">日付</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500">時間帯</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500">部屋</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500">内容</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500">種別</th>
                {batch.status !== 'applied' && (
                  <th className="px-3 py-2 text-center text-xs font-bold text-gray-500">操作</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.map(row => {
                const d = new Date(row.date + 'T00:00:00');
                const diff = DIFF_LABELS[row.diff_type];
                return (
                  <tr key={row.id} className={`${diff.bg} ${row.review_status === 'rejected' ? 'opacity-40' : ''}`}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {d.getMonth() + 1}/{d.getDate()}({DOW[d.getDay()]})
                    </td>
                    <td className="px-3 py-2">{row.slot}</td>
                    <td className="px-3 py-2">{shortRoomName(row.room)}</td>
                    <td className="px-3 py-2">
                      {row.diff_type === 'update' ? (
                        <div>
                          <span className="line-through text-gray-400">{row.existing_title}</span>
                          <span className="mx-1">→</span>
                          <span className="font-bold">{row.title}</span>
                        </div>
                      ) : row.diff_type === 'delete' ? (
                        <span className="line-through">{row.title}</span>
                      ) : (
                        <span className="font-bold">{row.title}</span>
                      )}
                      {row.org_guess && <span className="ml-1 text-xs text-gray-400">({row.org_guess})</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${diff.text} ${diff.bg} border ${
                        row.diff_type === 'add' ? 'border-emerald-200' :
                        row.diff_type === 'update' ? 'border-amber-200' :
                        row.diff_type === 'delete' ? 'border-red-200' : 'border-gray-200'
                      }`}>
                        {diff.label}
                      </span>
                    </td>
                    {batch.status !== 'applied' && (
                      <td className="px-3 py-2 text-center">
                        {row.review_status === 'pending' ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => updateRowStatus(row.id, 'approved')}
                              className="p-1 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200"
                              title="承認"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => updateRowStatus(row.id, 'rejected')}
                              className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                              title="却下"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : row.review_status === 'approved' ? (
                          <span className="text-xs text-emerald-600 font-bold">承認済</span>
                        ) : (
                          <span className="text-xs text-red-400">却下</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 反映ボタン */}
      {batch.status !== 'applied' && approvedCount > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleApply}
            disabled={applying}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 shadow-sm"
          >
            {applying ? '反映中...' : `反映する（承認済み: ${approvedCount}件）`}
          </button>
        </div>
      )}
    </div>
  );
}
