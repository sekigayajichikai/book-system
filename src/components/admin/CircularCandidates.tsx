import { useState, useEffect, useCallback } from 'react';
import { Check, X, RefreshCw, ClipboardPaste, Newspaper, AlertTriangle } from 'lucide-react';

/**
 * 回覧板からの予定候補セクション（インポートタブ用）
 *
 * デジタル回覧板アプリがAI抽出した予定候補（general_import_rows）を一覧表示し、
 * 承認（calendar_eventsへ登録）/ 却下する。回覧板アプリでコピーした
 * JSONを貼り付けて手動で候補を追加することもできる。
 */

interface CandidateRow {
  id: string;
  date: string;
  title: string;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  article_url: string | null;
  is_duplicate: boolean;
}

export default function CircularCandidates() {
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchRows = useCallback(async () => {
    const res = await fetch('/api/import-events');
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    return (data.rows || []) as CandidateRow[];
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchRows()
      .then(result => { if (!cancelled) setRows(result); })
      .catch(() => { if (!cancelled) setMessage({ type: 'error', text: '候補一覧の取得に失敗しました' }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchRows]);

  /** 手動更新（スピナー表示付き） */
  const handleRefresh = async () => {
    setLoading(true);
    try {
      setRows(await fetchRows());
    } catch {
      setMessage({ type: 'error', text: '候補一覧の取得に失敗しました' });
    } finally {
      setLoading(false);
    }
  };

  /** JSON貼り付けで候補を追加 */
  const handlePaste = async () => {
    setMessage(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(pasteText);
    } catch {
      setMessage({ type: 'error', text: 'JSONの形式が正しくありません' });
      return;
    }
    const rowsToSend = Array.isArray(parsed) ? parsed : [parsed];
    setProcessing(true);
    try {
      const res = await fetch('/api/import-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: 'browser-upload', rows: rowsToSend }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'API error');
      setMessage({
        type: 'success',
        text: `候補を受け付けました（追加${data.added} / 既出スキップ${data.skipped}${data.invalid ? ` / 無効${data.invalid}` : ''}）`,
      });
      setPasteText('');
      setShowPaste(false);
      setRows(await fetchRows());
    } catch (err) {
      setMessage({ type: 'error', text: `候補の追加に失敗しました: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setProcessing(false);
    }
  };

  /** 承認 or 却下 */
  const handleAction = async (ids: string[], action: 'apply' | 'reject') => {
    if (ids.length === 0) return;
    setProcessing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/import-events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'API error');
      if (action === 'apply') {
        setMessage({
          type: data.errors?.length ? 'error' : 'success',
          text: data.errors?.length
            ? `${data.applied}件登録、失敗あり: ${data.errors.join(' / ')}`
            : `${data.applied}件をカレンダーに登録しました`,
        });
      }
      setRows(await fetchRows());
    } catch (err) {
      setMessage({ type: 'error', text: `処理に失敗しました: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setProcessing(false);
    }
  };

  const nonDuplicateIds = rows.filter(r => !r.is_duplicate).map(r => r.id);

  return (
    <div className="bg-white rounded-xl border border-sky-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-sky-700 flex items-center gap-1.5">
          <Newspaper size={15} />
          回覧板からの予定候補{rows.length > 0 && `（${rows.length}件）`}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPaste(v => !v)}
            className="text-xs text-sky-600 hover:text-sky-800 font-bold flex items-center gap-1"
          >
            <ClipboardPaste size={13} /> JSONを貼り付け
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> 更新
          </button>
        </div>
      </div>

      {showPaste && (
        <div className="mb-3 space-y-2">
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder='回覧板アプリの「カレンダー用JSONをコピー」で取得したJSONを貼り付け'
            className="w-full h-28 border border-gray-200 rounded-lg p-2 text-xs font-mono"
          />
          <button
            onClick={handlePaste}
            disabled={processing || !pasteText.trim()}
            className="px-3 py-1.5 bg-sky-600 text-white text-xs font-bold rounded-lg disabled:opacity-40"
          >
            候補として取り込む
          </button>
        </div>
      )}

      {message && (
        <div className={`mb-3 p-2 rounded-lg text-xs font-bold ${message.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">
          確認待ちの候補はありません（回覧板アプリから届くとここに表示されます）
        </p>
      ) : (
        <>
          <div className="space-y-1.5 mb-3">
            {rows.map(r => (
              <div
                key={r.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg border ${r.is_duplicate ? 'border-amber-200 bg-amber-50/50' : 'border-gray-100 bg-gray-50'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-bold text-sky-700">{r.date}</span>
                    {(r.start_time || r.end_time) && (
                      <span className="text-xs text-gray-500">
                        {r.start_time}{r.end_time ? `〜${r.end_time}` : '〜'}
                      </span>
                    )}
                    <span className="text-sm font-bold text-gray-800">{r.title}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                    {r.location && <span>📍 {r.location}</span>}
                    {r.article_url && (
                      <a href={r.article_url} target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline">
                        記事を確認
                      </a>
                    )}
                    {r.is_duplicate && (
                      <span className="text-amber-600 font-bold flex items-center gap-0.5">
                        <AlertTriangle size={11} /> 同じ日付・名前の予定が登録済み
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleAction([r.id], 'apply')}
                  disabled={processing}
                  className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg disabled:opacity-40"
                  title="カレンダーに登録"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => handleAction([r.id], 'reject')}
                  disabled={processing}
                  className="p-1.5 text-gray-400 hover:bg-red-100 hover:text-red-500 rounded-lg disabled:opacity-40"
                  title="却下"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          {nonDuplicateIds.length > 1 && (
            <button
              onClick={() => handleAction(nonDuplicateIds, 'apply')}
              disabled={processing}
              className="w-full py-2 bg-sky-600 text-white text-sm font-bold rounded-lg disabled:opacity-40"
            >
              重複以外の{nonDuplicateIds.length}件をまとめて登録
            </button>
          )}
        </>
      )}
    </div>
  );
}
