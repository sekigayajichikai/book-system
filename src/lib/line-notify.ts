// @ts-nocheck — 未完成の「将来用」LINE通知機能。現在どこからも呼ばれておらず、
// 参照しているフィールド（startTime/purpose/name など）は今の BookingRequest 型に未整備。
// 機能を実装する際に型を整えたうえで、この行を削除すること。
import type { BookingRequest } from '../types';

/**
 * LINE Messaging API で事務局へ予約リクエストを通知する。
 * Push API を使って特定のユーザー or グループに送信。
 */
export async function sendLineNotification(
  channelAccessToken: string,
  targetId: string,
  booking: BookingRequest,
): Promise<void> {
  const lines = [
    '📋 予約リクエストが届きました',
    '',
    `📅 ${booking.date}`,
    `🕐 ${booking.slot}`,
    `🏠 ${booking.room}`,
    `📝 ${booking.title}`,
  ];
  if (booking.org) lines.push(`🏢 ${booking.org}`);
  if (booking.price != null) lines.push(`💰 ¥${booking.price.toLocaleString()}`);
  lines.push('', 'スプレッドシートに登録してください。');
  const message = lines.join('\n');

  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      to: targetId,
      messages: [{ type: 'text', text: message }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LINE API error ${res.status}: ${text}`);
  }
}
