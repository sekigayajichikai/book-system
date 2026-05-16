import { useState, useEffect } from 'react';
import { X, LogIn } from 'lucide-react';

interface OrgLoginProps {
  onLogin: (orgId: string, orgName: string) => void;
  onClose: () => void;
}

export default function OrgLogin({ onLogin, onClose }: OrgLoginProps) {
  const [orgNames, setOrgNames] = useState<string[]>([]);
  const [orgName, setOrgName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/masters')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.orgs) {
          const names: string[] = [];
          Object.values(data.orgs as Record<string, { name: string }[]>).forEach(list => {
            list.forEach(o => names.push(o.name));
          });
          setOrgNames(names.sort());
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName || !passcode) return setError('団体名とパスコードを入力してください');
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'org', org_name: orgName, passcode }),
      });
      const data = await res.json();

      if (res.ok && data.org_id) {
        localStorage.setItem('org_token', data.token);
        localStorage.setItem('org_id', data.org_id);
        localStorage.setItem('org_name', data.org_name);
        onLogin(data.org_id, data.org_name);
      } else {
        setError(data.error || 'ログインに失敗しました');
      }
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">団体ログイン</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} className="text-gray-400" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">団体名</label>
            <select
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="">選択してください</option>
              {orgNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">パスコード</label>
            <input
              type="password"
              value={passcode}
              onChange={e => setPasscode(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              placeholder="パスコードを入力"
            />
          </div>

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading || !orgName || !passcode}
            className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 text-base"
          >
            <LogIn size={18} />
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-4 text-center">
          パスコードは事務局から発行されたものを入力してください
        </p>
      </div>
    </div>
  );
}
