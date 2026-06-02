import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, X, AlertTriangle, Plus, Trash2, RefreshCw, ArrowRight, Upload, Cloud } from 'lucide-react';
import { shortRoomName } from '../../constants';
import * as XLSX from 'xlsx';

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

// Excelパース: ORG_MAP
const ORG_MAP: Record<string, string> = {
  '囲碁': '自主活動部', 'カラオケ': '自主活動部', '関ヶ谷クラブ': '自主活動部',
  'ディスクコンサート': '自主活動部', '図書': '自主活動部', 'ふれあい': '自主活動部',
  'ブルーベル': '自主活動部', 'ブル―ベル': '自主活動部', 'トーンチャイム': '自主活動部',
  'ちりとてちん': '自主活動部', 'オペラ': '自主活動部', '読書': '自主活動部',
  'つなぎの会': '自主活動部', 'ききょう': '自主活動部', '見まわり隊': '自主活動部',
  '役員': '役員', '総会': '役員', '新役員': '役員',
  '事務局': '事務局', '会館予約': '事務局', '会計監査': '事務局',
  '防災': '委員会', 'HP': '委員会', 'DX': '委員会', '環境': '委員会',
  '広報': '委員会', '青少年': '委員会',
  '地区長': '地区長・班長', '班長': '地区長・班長', '合同会議': '地区長・班長',
};

function guessOrg(title: string): string {
  for (const [kw, org] of Object.entries(ORG_MAP)) {
    if (title.includes(kw)) return org;
  }
  return '';
}

// Excelパース: シートからイベント抽出
const ROWS_DEF: [number, string, string][] = [
  [3, '午前', '会議室'], [4, '午前', '和室（畳側）'],
  [5, '午前', '和室（椅子側）'], [6, '午前', '図書室'],
  [8, '午後', '会議室'], [9, '午後', '和室（畳側）'],
  [10, '午後', '和室（椅子側）'], [11, '午後', '図書室'],
  [12, '夜間', '会議室'],
];

interface ParsedRow {
  date: string;
  slot: string;
  room: string;
  title: string;
  org_guess: string;
}

function parseExcel(file: ArrayBuffer): { year: number; month: number; rows: ParsedRow[] }[] {
  const wb = XLSX.read(file, { type: 'array' });
  const results: { year: number; month: number; rows: ParsedRow[] }[] = [];

  // 当月〜12ヶ月先のみ対象
  const now = new Date();
  const minYM = now.getFullYear() * 12 + now.getMonth(); // 当月
  const maxYM = minYM + 12; // 12ヶ月先

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws['I1'] || !ws['L1']) continue;
    const year = Number(ws['I1'].v);
    const month = Number(ws['L1'].v);
    if (!(year >= 2020 && year <= 2099 && month >= 1 && month <= 12)) continue;

    const ym = year * 12 + (month - 1);
    if (ym < minYM || ym > maxYM) continue; // 範囲外はスキップ

    // 日付列を検出（Row2, 0-indexed row=1）
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    const dateCols: { col: number; day: number }[] = [];
    for (let c = 0; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 1, c })];
      if (cell && cell.t === 'n' && cell.v > 40000) {
        const d = XLSX.SSF.parse_date_code(cell.v);
        if (d.m === month) dateCols.push({ col: c, day: d.d });
      }
    }

    const rows: ParsedRow[] = [];
    for (const [rowIdx, slot, room] of ROWS_DEF) {
      for (const { col, day } of dateCols) {
        const cell = ws[XLSX.utils.encode_cell({ r: rowIdx, c: col })];
        if (!cell || !cell.v) continue;
        const title = String(cell.v).trim().replace(/\u3000/g, '');
        if (!title || title === '×') continue;
        rows.push({
          date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          slot, room, title,
          org_guess: guessOrg(title),
        });
      }
    }

    if (rows.length > 0) results.push({ year, month, rows });
  }

  return results;
}

export default function ImportTab() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'add' | 'update' | 'delete'>('all');
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingGeneral, setSyncingGeneral] = useState(false);
  const [driveLastModified, setDriveLastModified] = useState<string | null>(null);
  const [sourceDate, setSourceDate] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchImport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/import');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      setBatches(data.batches || []);
      setRows(data.rows || []);
    } catch (err) {
      console.error('インポートデータ取得エラー:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImport();
    fetch('/api/sync-drive').then(r => r.json()).then(d => {
      if (d.lastModified) {
        setDriveLastModified(d.lastModified);
        // 最終更新日の直近の金曜日を計算
        const mod = new Date(d.lastModified);
        const day = mod.getDay();
        if (day === 5) {
          // 金曜日ならその日
        } else {
          const diff = day >= 5 ? day - 5 : day + 2;
          mod.setDate(mod.getDate() - diff);
        }
        setSourceDate(`${mod.getFullYear()}-${String(mod.getMonth() + 1).padStart(2, '0')}-${String(mod.getDate()).padStart(2, '0')}`);
      }
    }).catch(() => {});
  }, [fetchImport]);

  // Excelファイルアップロード処理
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseExcel(buffer);

      if (parsed.length === 0) {
        setMessage({ type: 'error', text: '有効なシートが見つかりませんでした' });
        setUploading(false);
        return;
      }

      // 各月ごとにAPIにPOST
      let totalStats = { add: 0, update: 0, delete: 0, skip: 0 };
      for (const { year, month, rows: parsedRows } of parsed) {
        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: 'browser-upload',
            year, month,
            rows: parsedRows,
          }),
        });
        const data = await res.json();
        if (data.ok && data.stats) {
          totalStats.add += data.stats.add || 0;
          totalStats.update += data.stats.update || 0;
          totalStats.delete += data.stats.delete || 0;
          totalStats.skip += data.stats.skip || 0;
        }
      }

      setMessage({
        type: 'success',
        text: `${parsed.length}ヶ月分を取込みました（新規${totalStats.add} / 変更${totalStats.update} / 削除${totalStats.delete}）`,
      });
      await fetchImport();
    } catch (err) {
      console.error('Excel parse error:', err);
      setMessage({ type: 'error', text: 'Excelの読み取りに失敗しました' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      handleFileUpload(file);
    } else {
      setMessage({ type: 'error', text: 'Excelファイル(.xlsx)を選択してください' });
    }
  };

  // Googleドライブから取込
  const handleSyncDrive = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/sync-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({
          type: 'success',
          text: `Googleドライブから${data.months}ヶ月分を取込みました（新規${data.stats.add} / 変更${data.stats.update} / 削除${data.stats.delete}）`,
        });
        await fetchImport();
      } else {
        setMessage({ type: 'error', text: data.error || '取込に失敗しました' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Googleドライブからの取込に失敗しました' });
    } finally {
      setSyncing(false);
    }
  };

  // 予定スプレッドシートから取込
  const handleSyncGeneral = async () => {
    setSyncingGeneral(true);
    setMessage(null);
    try {
      const res = await fetch('/api/sync-general', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({
          type: 'success',
          text: `予定を取込みました（新規${data.imported} / 更新${data.updated} / 休館${data.closures || 0}）`,
        });
      } else {
        setMessage({ type: 'error', text: data.error || '取込に失敗しました' });
      }
    } catch {
      setMessage({ type: 'error', text: '予定スプレッドシートの取込に失敗しました' });
    } finally {
      setSyncingGeneral(false);
    }
  };

  const filteredRows = rows.filter(r => {
    if (filter === 'all') return true;
    return r.diff_type === filter;
  });

  const pendingCount = rows.filter(r => r.review_status === 'pending').length;
  const approvedCount = rows.filter(r => r.review_status === 'approved').length;
  const hasBatches = batches.length > 0;

  // 月ごとにグループ化（バッチIDでRowsを紐づけ）
  const batchMap = new Map(batches.map(b => [b.id, b]));
  const rowsByBatch: Record<string, ImportRow[]> = {};
  for (const r of filteredRows) {
    // batch_idからバッチを特定
    for (const b of batches) {
      const startDate = `${b.target_year}-${String(b.target_month).padStart(2, '0')}-01`;
      const endMonth = b.target_month === 12 ? 1 : b.target_month + 1;
      const endYear = b.target_month === 12 ? b.target_year + 1 : b.target_year;
      const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
      if (r.date >= startDate && r.date < endDate) {
        if (!rowsByBatch[b.id]) rowsByBatch[b.id] = [];
        rowsByBatch[b.id].push(r);
        break;
      }
    }
  }

  // 行レビュー更新
  const updateRowStatus = async (rowId: string, status: 'approved' | 'rejected') => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, review_status: status } : r));
    await fetch('/api/import', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: [{ id: rowId, review_status: status }] }),
    });
  };

  // 一括取込
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

  // 全て取消（バッチごとDBから削除）
  const rejectAll = async () => {
    if (!confirm('インポートデータを全て取消しますか？')) return;
    try {
      await fetch('/api/import', { method: 'DELETE' });
      setBatches([]);
      setRows([]);
      setMessage({ type: 'success', text: 'インポートデータを取消しました' });
    } catch {
      setMessage({ type: 'error', text: '取消に失敗しました' });
    }
  };

  // 反映（全バッチ一括）
  const handleApply = async () => {
    if (batches.length === 0) return;
    if (!confirm(`承認済み ${approvedCount}件 を反映しますか？`)) return;

    setApplying(true);
    setMessage(null);
    let totalApplied = 0;
    try {
      for (const b of batches) {
        const res = await fetch('/api/import-apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch_id: b.id, source_updated_at: sourceDate }),
        });
        const data = await res.json();
        if (data.ok) totalApplied += data.applied || 0;
      }
      setMessage({ type: 'success', text: `${totalApplied}件を反映しました` });
      await fetchImport();
    } catch {
      setMessage({ type: 'error', text: '反映に失敗しました' });
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <div className="text-gray-400 text-sm py-12 text-center">読み込み中...</div>;

  const driveModifiedStr = driveLastModified
    ? new Date(driveLastModified).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  // アップロードエリア（常に表示）
  const uploadArea = (
    <div className="space-y-4">

    {/* ===== 会館予約のインポート ===== */}
    <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-3">
      <h3 className="text-sm font-bold text-blue-700">会館予約のインポート</h3>
      <div className="flex gap-3">
        {/* Googleドライブから取込 */}
        <button
          onClick={handleSyncDrive}
          disabled={syncing || uploading}
          className="flex-1 border-2 border-dashed border-blue-200 rounded-xl p-4 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Cloud size={24} className="mx-auto text-blue-300 mb-1" />
          {syncing ? (
            <p className="text-blue-600 font-bold text-sm">取込中...</p>
          ) : (
            <>
              <p className="text-blue-500 text-sm font-bold">Googleドライブから取込</p>
              <div className="text-left inline-block mt-1.5 text-xs text-gray-400">
                <p><span className="text-gray-500">アカウント：</span>関ヶ谷自治会DX委員会</p>
                <p><span className="text-gray-500">ファイル　：</span>カレンダー &gt; 会館予定表 &gt; 会館日程表（新）.xlsx</p>
                {driveModifiedStr && <p><span className="text-gray-500">最終更新　：</span>{driveModifiedStr}</p>}
              </div>
            </>
          )}
        </button>

        {/* ファイルアップロード */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className="flex-1 border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
          <Upload size={24} className="mx-auto text-gray-300 mb-1" />
          {uploading ? (
            <p className="text-emerald-600 font-bold text-sm">読み取り中...</p>
          ) : (
            <>
              <p className="text-gray-500 text-sm font-bold">Excelファイルをアップロード</p>
              <p className="text-gray-400 text-xs mt-1">ドラッグ＆ドロップまたはクリック</p>
            </>
          )}
        </div>
      </div>
    </div>

    {/* ===== 一般予定のインポート ===== */}
    <div className="bg-white rounded-xl border border-violet-200 p-4">
      <h3 className="text-sm font-bold text-violet-700 mb-3">一般予定・休館日のインポート</h3>
      <button
        onClick={handleSyncGeneral}
        disabled={syncingGeneral}
        className="w-full border-2 border-dashed border-violet-200 rounded-xl p-4 text-center hover:border-violet-400 hover:bg-violet-50/30 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {syncingGeneral ? (
          <p className="text-violet-600 font-bold text-sm">取込中...</p>
        ) : (
          <>
            <p className="text-violet-500 text-sm font-bold">予定スプレッドシートから取込</p>
            <div className="text-left inline-block mt-1.5 text-xs text-gray-400">
              <p><span className="text-gray-500">アカウント：</span>関ヶ谷自治会DX委員会</p>
              <p><span className="text-gray-500">ファイル　：</span>カレンダー &gt; 予定スプレッドシート</p>
            </div>
          </>
        )}
      </button>
    </div>

    </div>
  );

  if (!hasBatches) {
    return (
      <div className="space-y-6">
        {uploadArea}
        {message && (
          <div className={`p-3 rounded-lg text-sm font-bold ${message.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {message.text}
          </div>
        )}
        <div className="text-center py-6">
          <AlertTriangle size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm">インポートデータがありません</p>
          <p className="text-gray-300 text-xs mt-1">上のエリアからExcelファイルをアップロードしてください</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* アップロードエリア */}
      {uploadArea}

      {/* メッセージ */}
      {message && (
        <div className={`p-3 rounded-lg text-sm font-bold ${message.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* フィルタ + 一括操作 */}
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
          <button onClick={fetchImport} className="p-2 hover:bg-gray-100 rounded-full" title="再読み込み">
            <RefreshCw size={16} className="text-gray-400" />
          </button>
          <button
            onClick={rejectAll}
            disabled={pendingCount === 0}
            className="px-3 py-1.5 bg-gray-500 text-white rounded-lg text-xs font-bold hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            全て取消
          </button>
          <button
            onClick={approveAll}
            disabled={pendingCount === 0}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            全て承認
          </button>
        </div>
      </div>

      {/* 月ごとの差分一覧 */}
      {batches.map(b => {
        const monthRows = rowsByBatch[b.id] || [];
        if (monthRows.length === 0 && filter !== 'all') return null;
        const addCount = monthRows.filter(r => r.diff_type === 'add').length;
        const updateCount = monthRows.filter(r => r.diff_type === 'update').length;
        const deleteCount = monthRows.filter(r => r.diff_type === 'delete').length;

        return (
          <div key={b.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* 月ヘッダー */}
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-gray-800">{b.target_year}年{b.target_month}月</h3>
                <div className="flex gap-2 text-xs">
                  {addCount > 0 && <span className="text-emerald-600 font-bold">+{addCount}</span>}
                  {updateCount > 0 && <span className="text-amber-600 font-bold">→{updateCount}</span>}
                  {deleteCount > 0 && <span className="text-red-600 font-bold">-{deleteCount}</span>}
                </div>
              </div>
              {monthRows.length === 0 && (
                <span className="text-xs text-gray-400">差分なし</span>
              )}
            </div>

            {monthRows.length > 0 && (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {monthRows.map(row => {
                    const d = new Date(row.date + 'T00:00:00');
                    const diff = DIFF_LABELS[row.diff_type];
                    return (
                      <tr key={row.id} className={`${diff.bg} ${row.review_status === 'rejected' ? 'opacity-40' : ''}`}>
                        <td className="px-3 py-2 whitespace-nowrap w-24">
                          {d.getMonth() + 1}/{d.getDate()}({DOW[d.getDay()]})
                        </td>
                        <td className="px-3 py-2 w-16">{row.slot}</td>
                        <td className="px-3 py-2 w-24">{shortRoomName(row.room)}</td>
                        <td className="px-3 py-2">
                          {row.diff_type === 'update' ? (
                            <span>
                              <span className="line-through text-gray-400">{row.existing_title}</span>
                              <span className="mx-1">→</span>
                              <span className="font-bold">{row.title}</span>
                            </span>
                          ) : row.diff_type === 'delete' ? (
                            <span className="line-through">{row.title}</span>
                          ) : (
                            <span className="font-bold">{row.title}</span>
                          )}
                          {row.org_guess && <span className="ml-1 text-xs text-gray-400">({row.org_guess})</span>}
                        </td>
                        <td className="px-3 py-2 w-16">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${diff.text} border ${
                            row.diff_type === 'add' ? 'border-emerald-200 bg-emerald-50' :
                            row.diff_type === 'update' ? 'border-amber-200 bg-amber-50' :
                            'border-red-200 bg-red-50'
                          }`}>
                            {diff.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 w-20 text-center">
                          {row.review_status === 'pending' ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => updateRowStatus(row.id, 'approved')} className="p-1 bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200" title="承認"><Check size={14} /></button>
                              <button onClick={() => updateRowStatus(row.id, 'rejected')} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200" title="却下"><X size={14} /></button>
                            </div>
                          ) : row.review_status === 'approved' ? (
                            <span className="text-xs text-emerald-600 font-bold">承認済</span>
                          ) : (
                            <span className="text-xs text-red-400">却下</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {/* 反映エリア */}
      {approvedCount > 0 && (
        <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-gray-600">予定表の更新日：</label>
            <input
              type="date"
              value={sourceDate}
              onChange={e => setSourceDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
            <span className="text-xs text-gray-400">（閲覧者に表示される更新日）</span>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleApply}
              disabled={applying || !sourceDate}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 shadow-sm"
            >
              {applying ? '反映中...' : `反映する（承認済み: ${approvedCount}件）`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
