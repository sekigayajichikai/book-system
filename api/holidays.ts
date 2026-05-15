import type { VercelRequest, VercelResponse } from '@vercel/node';

const ICAL_URL = 'https://calendar.google.com/calendar/ical/ja.japanese%23holiday%40group.v.calendar.google.com/public/basic.ics';

interface Holiday {
  date: string;
  name: string;
}

function parseIcal(icsText: string, year?: number): Holiday[] {
  const holidays: Holiday[] = [];
  const events = icsText.split('BEGIN:VEVENT').slice(1);

  for (const block of events) {
    const dateMatch = block.match(/DTSTART;VALUE=DATE:(\d{8})/);
    const summaryMatch = block.match(/SUMMARY:(.+)/);
    const descMatch = block.match(/DESCRIPTION:(.+)/);

    if (!dateMatch || !summaryMatch) continue;

    // 国民の祝日のみ（description === "祝日"）
    const desc = descMatch?.[1]?.trim();
    if (desc !== '祝日') continue;

    const d = dateMatch[1];
    const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    const name = summaryMatch[1].trim();

    if (year && !date.startsWith(String(year))) continue;

    holidays.push({ date, name });
  }

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;

    const response = await fetch(ICAL_URL);
    if (!response.ok) throw new Error(`iCal fetch failed: ${response.status}`);

    const icsText = await response.text();
    const holidays = parseIcal(icsText, year);

    // 祝日データはほぼ静的なので長めにキャッシュ
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    res.json(holidays);
  } catch (err) {
    console.error('祝日取得エラー:', err);
    res.status(500).json({ error: '祝日の取得に失敗しました' });
  }
}
