-- ============================================================
-- Migration 012: Excelインポート ステージングテーブル
--
-- Excel → パース → ステージング → 差分確認 → 承認反映
-- ============================================================

-- インポートバッチ管理
CREATE TABLE import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_file text NOT NULL DEFAULT '会館日程表（新）.xlsx',
  source_hash text,
  target_year integer NOT NULL,
  target_month integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  total_rows integer DEFAULT 0,
  stats jsonb DEFAULT '{}',
  applied_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 同一年月でpending/reviewingのバッチは1つだけ
CREATE UNIQUE INDEX idx_import_batches_active
  ON import_batches(target_year, target_month)
  WHERE status IN ('pending', 'reviewing');

-- インポート行（パース済みデータ + 差分情報）
CREATE TABLE import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  date date NOT NULL,
  slot text NOT NULL,
  room text NOT NULL,
  title text NOT NULL,
  org_guess text,
  diff_type text NOT NULL DEFAULT 'add',
  existing_booking_id uuid,
  existing_title text,
  review_status text NOT NULL DEFAULT 'pending',
  review_note text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_import_rows_batch ON import_rows(batch_id);
CREATE INDEX idx_import_rows_review ON import_rows(batch_id, review_status);
