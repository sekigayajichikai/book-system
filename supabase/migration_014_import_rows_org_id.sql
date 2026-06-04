-- ============================================================
-- Migration 014: import_rows に org_id カラム追加
--
-- インポート時に団体を紐付けるためのカラム。
-- org_guessから自動マッチし、管理者が確認・変更できる。
-- ============================================================

ALTER TABLE import_rows
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES booking_organizations(id);
