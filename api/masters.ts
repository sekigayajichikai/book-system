import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/masters
 *
 * GAS Web App 経由でスプレッドシートの団体マスタを取得する。
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gasUrl = process.env.GAS_WEBAPP_URL;
  if (!gasUrl) {
    return res.status(500).json({ error: 'Missing GAS_WEBAPP_URL' });
  }

  try {
    const url = `${gasUrl}?action=masters`;
    const gasRes = await fetch(url, { redirect: 'follow' });
    if (!gasRes.ok) throw new Error(`GAS API error ${gasRes.status}`);

    const data = await gasRes.json();

    // 長めにキャッシュ（マスタは頻繁に変わらない）
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch (err) {
    console.error('GAS API masters error:', err);
    return res.status(502).json({ error: 'Failed to fetch masters from spreadsheet' });
  }
}
