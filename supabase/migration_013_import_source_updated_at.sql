-- ============================================================
-- Migration 013: import_batches に source_updated_at カラム追加
--
-- 予定表の更新日を保存するためのカラム。
-- インポート時にExcel/Driveから取得した更新日を記録する。
-- ============================================================

ALTER TABLE import_batches
  ADD COLUMN IF NOT EXISTS source_updated_at date;
