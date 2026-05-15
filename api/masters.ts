import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/masters
 *
 * Supabase から各種マスタデータを取得する。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    const [orgsRes, roomsRes, slotsRes, equipRes, categoriesRes] = await Promise.all([
      supabase.from('booking_organizations').select('*').order('category').order('name'),
      supabase.from('booking_rooms').select('*').order('sort_order'),
      supabase.from('booking_time_slots').select('*').order('sort_order'),
      supabase.from('booking_equipment').select('*').order('sort_order'),
      supabase.from('booking_usage_categories').select('*').order('sort_order'),
    ]);

    // 団体をカテゴリ別にグルーピング（フロントの既存形式に合わせる）
    const orgsByCategory: Record<string, Array<{
      name: string;
      tier: string;
      presets: string[];
      equipment: string[];
    }>> = {};

    (orgsRes.data || []).forEach(org => {
      if (!orgsByCategory[org.category]) orgsByCategory[org.category] = [];
      orgsByCategory[org.category].push({
        name: org.name,
        tier: org.category,
        presets: org.presets || [],
        equipment: org.default_equipment || [],
      });
    });

    // 時間帯をslots形式に変換
    const slots: Record<string, { start: string; end: string }> = {};
    (slotsRes.data || []).forEach(s => {
      slots[s.slot_key] = { start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) };
    });

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    return res.status(200).json({
      orgs: orgsByCategory,
      rooms: (roomsRes.data || []).map(r => r.name),
      slots,
      equipment: equipRes.data || [],
      categories: categoriesRes.data || [],
    });
  } catch (err) {
    console.error('Supabase masters fetch error:', err);
    return res.status(500).json({ error: 'マスタデータの取得に失敗しました' });
  }
}
