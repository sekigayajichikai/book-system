import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { Plugin } from 'vite';
import { createClient } from '@supabase/supabase-js';

/** ローカル開発用: /api/* をSupabaseに中継するミドルウェア */
function supabaseProxyPlugin(supabaseUrl: string, supabaseKey: string): Plugin {
  const supabase = createClient(supabaseUrl, supabaseKey);

  return {
    name: 'supabase-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        try {
          if (req.url.startsWith('/api/calendar')) {
            const params = new URL(req.url, 'http://localhost').searchParams;
            const y = Number(params.get('year'));
            const m = Number(params.get('month'));
            const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
            const endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

            const { data: bookings } = await supabase
              .from('bookings')
              .select('*')
              .gte('date', startDate)
              .lt('date', endDate)
              .in('status', ['CONFIRMED', 'PENDING']);

            const { data: slots } = await supabase
              .from('booking_time_slots')
              .select('slot_key, start_time, end_time');

            const slotMap: Record<string, { start: string; end: string }> = {};
            (slots || []).forEach((s: any) => {
              slotMap[s.slot_key] = { start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) };
            });

            const events = (bookings || []).map((b: any) => {
              const times = slotMap[b.slot] || { start: '09:00', end: '12:00' };
              return {
                id: b.id, summary: b.title, room: b.room,
                start: `${b.date}T${times.start}:00`, end: `${b.date}T${times.end}:00`,
                date: b.date, startTime: times.start, endTime: times.end,
              };
            });

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(events));

          } else if (req.url.startsWith('/api/masters')) {
            const [orgsRes, roomsRes, slotsRes] = await Promise.all([
              supabase.from('booking_organizations').select('*').order('category').order('name'),
              supabase.from('booking_rooms').select('*').order('sort_order'),
              supabase.from('booking_time_slots').select('*').order('sort_order'),
            ]);

            const orgsByCategory: Record<string, any[]> = {};
            (orgsRes.data || []).forEach((org: any) => {
              if (!orgsByCategory[org.category]) orgsByCategory[org.category] = [];
              orgsByCategory[org.category].push({
                name: org.name, tier: org.category,
                presets: org.presets || [], equipment: org.default_equipment || [],
              });
            });

            const slots: Record<string, { start: string; end: string }> = {};
            (slotsRes.data || []).forEach((s: any) => {
              slots[s.slot_key] = { start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) };
            });

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              orgs: orgsByCategory,
              rooms: (roomsRes.data || []).map((r: any) => r.name),
              slots,
            }));

          } else if (req.url.startsWith('/api/holidays')) {
            const params = new URL(req.url, 'http://localhost').searchParams;
            const year = params.get('year');
            const icalUrl = 'https://calendar.google.com/calendar/ical/ja.japanese%23holiday%40group.v.calendar.google.com/public/basic.ics';
            const icalRes = await fetch(icalUrl);
            const icsText = await icalRes.text();

            const holidays: { date: string; name: string }[] = [];
            const events = icsText.split('BEGIN:VEVENT').slice(1);
            for (const block of events) {
              const dateMatch = block.match(/DTSTART;VALUE=DATE:(\d{8})/);
              const summaryMatch = block.match(/SUMMARY:(.+)/);
              const descMatch = block.match(/DESCRIPTION:(.+)/);
              if (!dateMatch || !summaryMatch) continue;
              if (descMatch?.[1]?.trim() !== '祝日') continue;
              const d = dateMatch[1];
              const date = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
              if (year && !date.startsWith(year)) continue;
              holidays.push({ date, name: summaryMatch[1].trim() });
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(holidays));

          } else if (req.url.startsWith('/api/events')) {
            const params = new URL(req.url, 'http://localhost').searchParams;
            const y = Number(params.get('year'));
            const m = Number(params.get('month'));
            const vis = params.get('visibility');
            const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
            const endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

            let query = supabase
              .from('calendar_events')
              .select('id,date,title,display_title,event_type,visibility,location,start_time,end_time,memo,description,is_major')
              .gte('date', startDate)
              .lt('date', endDate)
              .neq('event_type', 'closure')
              .order('date')
              .order('start_time');

            if (vis === 'public' || vis === 'internal') {
              query = query.eq('visibility', vis);
            }

            const [eventsResult, slotResult] = await Promise.all([
              query,
              supabase.from('booking_time_slots').select('slot_key, start_time, end_time').order('sort_order'),
            ]);
            if (eventsResult.error) throw eventsResult.error;
            const events = eventsResult.data || [];

            const facilityIds = events.filter(e => e.event_type === 'facility').map(e => e.id);
            const bookingsByEvent: Record<string, { rooms: string[]; slots: string[]; orgName: string | null }> = {};
            if (facilityIds.length > 0) {
              const { data: bks } = await supabase
                .from('bookings')
                .select('event_id, room, slot, booking_organizations(name)')
                .in('event_id', facilityIds)
                .in('status', ['CONFIRMED', 'PENDING']);
              for (const b of bks || []) {
                if (!bookingsByEvent[b.event_id]) bookingsByEvent[b.event_id] = { rooms: [], slots: [], orgName: null };
                const entry = bookingsByEvent[b.event_id];
                if (!entry.rooms.includes(b.room)) entry.rooms.push(b.room);
                if (!entry.slots.includes(b.slot)) entry.slots.push(b.slot);
                if (!entry.orgName && (b as any).booking_organizations?.name) {
                  entry.orgName = (b as any).booking_organizations.name;
                }
              }
            }

            const slotMap: Record<string, { start: string; end: string }> = {};
            (slotResult.data || []).forEach((s: any) => {
              slotMap[s.slot_key] = { start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) };
            });

            const result = events.map(e => {
              const linked = bookingsByEvent[e.id];
              let startTime = e.start_time ? String(e.start_time).slice(0, 5) : null;
              let endTime = e.end_time ? String(e.end_time).slice(0, 5) : null;
              if (e.event_type === 'facility' && !startTime && linked) {
                const order = ['午前', '午後', '夜間'];
                const sorted = linked.slots.sort((a, b) => order.indexOf(a) - order.indexOf(b));
                const first = slotMap[sorted[0]];
                const last = slotMap[sorted[sorted.length - 1]];
                if (first) startTime = first.start;
                if (last) endTime = last.end;
              }
              return {
                id: e.id, date: e.date, title: e.display_title || e.title,
                originalTitle: e.title, displayTitle: e.display_title || null,
                eventType: e.event_type, visibility: e.visibility, location: e.location,
                startTime, endTime, orgName: e.memo || bookingsByEvent[e.id]?.orgName || null, description: e.description,
                rooms: linked?.rooms || [], slots: linked?.slots || [],
                isMajor: e.is_major || false,
              };
            });

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));

          } else if (req.url.startsWith('/api/bookings-view')) {
            const params = new URL(req.url, 'http://localhost').searchParams;
            const y = Number(params.get('year'));
            const m = Number(params.get('month'));
            const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
            const endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

            const [bookingsRes, slotsRes] = await Promise.all([
              supabase.from('bookings').select('*, booking_organizations(name)').gte('date', startDate).lt('date', endDate).in('status', ['CONFIRMED', 'PENDING']),
              supabase.from('booking_time_slots').select('slot_key, start_time, end_time'),
            ]);
            if (bookingsRes.error) throw bookingsRes.error;

            const slotMap: Record<string, { start: string; end: string }> = {};
            (slotsRes.data || []).forEach((s: any) => {
              slotMap[s.slot_key] = { start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) };
            });

            const events = (bookingsRes.data || []).map((b: any) => {
              const times = slotMap[b.slot] || { start: '09:00', end: '12:00' };
              return {
                id: b.id, summary: b.title, room: b.room,
                start: `${b.date}T${times.start}:00`, end: `${b.date}T${times.end}:00`,
                date: b.date, startTime: times.start, endTime: times.end,
                eventId: b.event_id || null,
                orgName: b.booking_organizations?.name || null,
              };
            });

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(events));

          } else if (req.url.startsWith('/api/booking') && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body);
                const { data, error } = await supabase
                  .from('bookings')
                  .insert({
                    date: parsed.date, slot: parsed.slot, room: parsed.room,
                    title: parsed.title, status: parsed.status || 'CONFIRMED',
                    category: parsed.category || null,
                    equipment: parsed.equipment || [], price: parsed.price || 0,
                  })
                  .select().single();

                if (error) {
                  res.statusCode = error.code === '23505' ? 409 : 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: error.message }));
                  return;
                }
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'save failed' }));
              }
            });
            return;

          } else if (req.url.startsWith('/api/auth') && req.method === 'POST') {
            let body = '';
            req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
            req.on('end', async () => {
              const parsed = JSON.parse(body);
              res.setHeader('Content-Type', 'application/json');

              // 事務局認証
              if (parsed.type === 'admin' || (!parsed.type && parsed.password)) {
                const adminPw = loadEnv('development', process.cwd(), '').ADMIN_PASSWORD;
                if (parsed.password === adminPw) {
                  const token = Buffer.from(JSON.stringify({ role: 'admin', t: Date.now() })).toString('base64');
                  res.end(JSON.stringify({ ok: true, role: 'admin', token }));
                } else {
                  res.statusCode = 401;
                  res.end(JSON.stringify({ error: 'パスワードが正しくありません' }));
                }
                return;
              }

              // 団体認証
              if (parsed.type === 'org') {
                const { data: org } = await supabase
                  .from('booking_organizations')
                  .select('id, name, category, passcode')
                  .eq('name', parsed.org_name)
                  .single();

                if (!org || org.passcode !== parsed.passcode) {
                  res.statusCode = 401;
                  res.end(JSON.stringify({ error: org ? 'パスコードが正しくありません' : '団体が見つかりません' }));
                  return;
                }
                const token = Buffer.from(JSON.stringify({ role: 'org', org_id: org.id, org_name: org.name, t: Date.now() })).toString('base64');
                res.end(JSON.stringify({ ok: true, role: 'org', token, org_id: org.id, org_name: org.name }));
                return;
              }

              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'type パラメータが必要です' }));
            });
            return;

          } else {
            return next();
          }
        } catch (err) {
          console.error('Supabase proxy error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'proxy error' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = env.SUPABASE_URL || '';
  const supabaseKey = env.SUPABASE_ANON_KEY || '';

  return {
    plugins: [
      react(),
      ...(supabaseUrl ? [supabaseProxyPlugin(supabaseUrl, supabaseKey)] : []),
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
