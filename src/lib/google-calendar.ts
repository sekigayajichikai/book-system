import type { CalendarEvent, RoomType } from '../types';

const ROOM_NAMES: RoomType[] = ['会議室', '和室（畳側）', '和室（椅子側）', '図書室'] as RoomType[];

/**
 * Googleカレンダーのイベントタイトルから部屋名とイベント名を分離する。
 * GASは `[会議室] 卓球サークル` の形式でタイトルをつける。
 */
export function parseEventTitle(summary: string): { room: RoomType | null; title: string } {
  const match = summary.match(/^\[(.+?)\]\s*(.*)$/);
  if (match) {
    const roomName = match[1] as RoomType;
    if (ROOM_NAMES.includes(roomName)) {
      return { room: roomName, title: match[2] || summary };
    }
  }
  return { room: null, title: summary };
}

/**
 * 時刻文字列を HH:mm に変換する。
 * ISO 8601 の dateTime または date を受け取る。
 */
function toHHmm(dateTime: string): string {
  const d = new Date(dateTime);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function toDateStr(dateTime: string): string {
  const d = new Date(dateTime);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

/**
 * Google Calendar API v3 からイベントを取得してパースする。
 */
export async function fetchCalendarEvents(
  calendarId: string,
  apiKey: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    key: apiKey,
    timeMin: new Date(timeMin).toISOString(),
    timeMax: new Date(timeMax).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar API error ${res.status}: ${text}`);
  }

  const data = await res.json() as { items?: GoogleCalendarEvent[] };
  const items = data.items ?? [];

  return items
    .filter(item => item.start.dateTime) // 終日イベントは除外（時間枠予約のみ）
    .map(item => {
      const { room, title } = parseEventTitle(item.summary ?? '');
      const startDT = item.start.dateTime!;
      const endDT = item.end.dateTime!;
      return {
        id: item.id,
        summary: title,
        room,
        start: startDT,
        end: endDT,
        date: toDateStr(startDT),
        startTime: toHHmm(startDT),
        endTime: toHHmm(endDT),
      };
    });
}
