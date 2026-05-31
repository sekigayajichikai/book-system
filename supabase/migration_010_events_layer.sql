-- ============================================================
-- Migration 010: イベント/施設利用 2層モデル
--
-- calendar_events を「イベント（親）」テーブルとして拡張し、
-- bookings（子）から event_id で参照する。
-- ============================================================

-- 1. calendar_events にカラム追加
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES booking_organizations(id),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

COMMENT ON COLUMN calendar_events.event_type IS 'general=会館不使用, facility=会館使用(bookings紐づき), closure=休館日';
COMMENT ON COLUMN calendar_events.visibility IS 'public=住民向け表示, internal=運営のみ';

-- 2. bookings に event_id FK 追加
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES calendar_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_event_id ON bookings(event_id);

-- 3. 既存の休館日データを event_type='closure' に変換
UPDATE calendar_events
SET event_type = 'closure'
WHERE is_closure = true;
