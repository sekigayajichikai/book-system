import { useState } from 'react';
import { Lock } from 'lucide-react';
import { supabase, ADMIN_EMAIL } from '../../lib/supabase';

/**
 * 事務局ログイン
 *
 * 2026-10-02 に Supabase Auth へ移行した。
 * それまでは署名のない文字列をブラウザに置くだけで、自分で作れば誰でも入れた。
 * いまはログイン状態を Supabase のクライアントが持ち、以後の読み書きが
 * 「ログイン済みの人」としてデータベースに届く。
 *
 * 画面はパスワード欄だけのまま。メールアドレスは回覧板ポータルと共通のものを裏で使う。
 */

interface AdminLoginProps {
  onLogin: (token: string) => void;
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL,
        password,
      });
      if (authError || !data.session) {
        setError('パスワードが正しくありません');
      } else {
        onLogin(data.session.access_token);
      }
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="bg-emerald-600 p-2 rounded-xl">
            <Lock className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-bold text-gray-800">事務局ログイン</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-base"
              placeholder="パスワードを入力"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors text-base"
          >
            {loading ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}
