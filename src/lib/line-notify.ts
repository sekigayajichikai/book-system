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
  const message = [
    '📋 予約リクエストが届きました',
    '',
    `📅 ${booking.date}`,
    `🕐 ${booking.startTime}〜${booking.endTime}`,
    `🏠 ${booking.room}`,
    `📝 ${booking.purpose}`,
    `👤 ${booking.name}（${booking.phone}）`,
    `💰 ¥${booking.price.toLocaleString()}`,
    '',
    'スプレッドシートに登録してください。',
  ].join('\n');

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
