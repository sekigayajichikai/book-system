import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/events?year=2026&month=5
 *
 * イベント一覧を取得（住民向け「予定」タブ用）。
 * calendar_events から回覧板由来・手入力の一般予定（general）を取得する。
 * 会館予約から自動作成された facility 型は返さない。
 *
 * オプション:
 *   &visibility=public  — 公開イベントのみ（デフォルト: 全件）
 *   &include_closures=true — 休館日も含める
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { year, month, visibility, include_closures } = req.query;
  if (!year || !month) {
    return res.status(400).json({ error: 'year and month query params required' });
  }

  const y = Number(year);
  const m = Number(month);
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
  const endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

  try {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

    // イベント取得 + 時間帯マスタを並列取得
    let query = supabase
      .from('calendar_events')
      .select('id,date,title,display_title,event_type,visibility,location,start_time,end_time,org_name,description,is_major,article_url')
      .gte('date', startDate)
      .lt('date', endDate);

    // 会館予約から自動作成された facility 型はカレンダーに出さない（会館予約状況タブで見る）
    query = query.in('event_type', include_closures === 'true' ? ['general', 'closure'] : ['general']);
    if (visibility === 'public' || visibility === 'internal') {
      query = query.eq('visibility', visibility);
    }
    query = query.order('date').order('start_time');

    const { data: events, error } = await query;
    if (error) throw error;

    // レスポンス組み立て
    const result = (events || []).map(e => {
      const startTime = e.start_time ? String(e.start_time).slice(0, 5) : null;
      const endTime = e.end_time ? String(e.end_time).slice(0, 5) : null;
      return {
        id: e.id,
        date: e.date,
        title: e.display_title || e.title,
        originalTitle: e.title,
        displayTitle: e.display_title || null,
        eventType: e.event_type,
        visibility: e.visibility,
        location: e.location,
        startTime,
        endTime,
        orgName: e.org_name || null,
        description: e.description,
        rooms: [],
        slots: [],
        isMajor: e.is_major || false,
        articleUrl: e.article_url || null,
      };
    });

    // no-cacheパラメータがある場合はキャッシュなし（管理側の即時反映用）
    if (req.query.nocache) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 's-maxage=3, stale-while-revalidate=5');
    }
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('Events fetch error:', err);
    return res.status(500).json({ error: 'イベントデータの取得に失敗しました', detail: err?.message || String(err) });
  }
}
