-- ============================================================
-- Migration 011: 既存 bookings からイベントを自動生成してリンク
--
-- 既存の bookings を (date, title, org_id) でグルーピングし、
-- calendar_events レコードを生成、event_id でリンクする。
--
-- ※ 実行前に SELECT で確認（下の確認クエリ参照）
-- ============================================================

-- ■ 確認用クエリ（実行前にこれで件数を確認してください）
-- SELECT date, title, org_id, count(*) as booking_count
-- FROM bookings
-- WHERE status IN ('CONFIRMED', 'PENDING') AND event_id IS NULL
-- GROUP BY date, title, org_id
-- ORDER BY date, title;

-- ■ Step 1: 既存 bookings から calendar_events を自動生成
INSERT INTO calendar_events (date, title, event_type, visibility, org_id)
SELECT DISTINCT
  b.date,
  b.title,
  'facility',
  'public',
  b.org_id
FROM bookings b
WHERE b.status IN ('CONFIRMED', 'PENDING')
  AND b.event_id IS NULL
  AND b.title != '予約あり'
  AND NOT EXISTS (
    -- 同じ date+title のイベントが既にあれば重複作成しない
    SELECT 1 FROM calendar_events ce
    WHERE ce.date = b.date AND ce.title = b.title AND ce.event_type = 'facility'
  )
GROUP BY b.date, b.title, b.org_id;

-- ■ Step 2: bookings に event_id をリンク
UPDATE bookings b
SET event_id = ce.id
FROM calendar_events ce
WHERE b.date = ce.date
  AND b.title = ce.title
  AND ce.event_type = 'facility'
  AND b.event_id IS NULL
  AND b.status IN ('CONFIRMED', 'PENDING')
  AND b.title != '予約あり';
