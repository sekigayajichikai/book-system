import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { Plugin } from 'vite';

/** ローカル開発用: /api/* をGAS Web Appに中継するミドルウェア */
function gasProxyPlugin(gasUrl: string): Plugin {
  return {
    name: 'gas-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        try {
          let targetUrl = '';
          let fetchOptions: RequestInit = { redirect: 'follow' };

          if (req.url.startsWith('/api/calendar')) {
            const params = new URL(req.url, 'http://localhost').searchParams;
            targetUrl = `${gasUrl}?action=load&year=${params.get('year')}&month=${params.get('month')}`;

            // GAS形式 → CalendarEvent[] に変換
            const gasRes = await fetch(targetUrl, fetchOptions);
            const data = await gasRes.json() as any;

            const SLOT_TIMES: Record<string, { start: string; end: string }> = {
              '午前': { start: '09:00', end: '12:00' },
              '午後': { start: '13:00', end: '16:00' },
              '夜間': { start: '17:00', end: '20:00' },
            };

            // GASの部屋名を正規化（洋室→和室）
            const normalizeRoom = (r: string | null) => {
              if (!r) return null;
              return r.replace('洋室', '和室');
            };

            const events = Object.entries(data.events || {}).map(([key, evt]: [string, any]) => {
              const times = SLOT_TIMES[evt.slot] || { start: '09:00', end: '12:00' };
              const dateStr = `${data.year}-${String(data.month).padStart(2, '0')}-${String(evt.day).padStart(2, '0')}`;
              return {
                id: evt.id || key,
                summary: evt.title,
                room: normalizeRoom(evt.room || null),
                start: `${dateStr}T${times.start}:00`,
                end: `${dateStr}T${times.end}:00`,
                date: dateStr,
                startTime: times.start,
                endTime: times.end,
              };
            });

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(events));

          } else if (req.url.startsWith('/api/masters')) {
            targetUrl = `${gasUrl}?action=masters`;
            const gasRes = await fetch(targetUrl, fetchOptions);
            const data = await gasRes.json();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));

          } else if (req.url.startsWith('/api/booking') && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body);
                // GAS POST はリダイレクトでボディが消えるため GET で save する
                const params = new URLSearchParams({
                  action: 'save',
                  year: String(parsed.year || new Date().getFullYear()),
                  month: String(parsed.month || new Date().getMonth() + 1),
                  day: String(parsed.day || ''),
                  slot: parsed.slot || '',
                  room: parsed.room || '',
                  title: parsed.title || '',
                  org: parsed.org || '',
                });
                // date が "2026-05-13" 形式の場合パース
                if (parsed.date && !parsed.year) {
                  const dp = parsed.date.split('-');
                  params.set('year', dp[0]);
                  params.set('month', dp[1]);
                  params.set('day', dp[2]);
                }
                const saveUrl = `${gasUrl}?${params.toString()}`;
                const gasRes = await fetch(saveUrl, { redirect: 'follow' });
                const data = await gasRes.json();
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              } catch (err) {
                console.error('Save proxy error:', err);
                res.statusCode = 502;
                res.end(JSON.stringify({ error: 'save failed' }));
              }
            });
            return;

          } else {
            return next();
          }
        } catch (err) {
          console.error('GAS proxy error:', err);
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'GAS proxy error' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const gasUrl = env.GAS_WEBAPP_URL || '';

  return {
    plugins: [
      react(),
      ...(gasUrl ? [gasProxyPlugin(gasUrl)] : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 3000,
    },
  };
});
