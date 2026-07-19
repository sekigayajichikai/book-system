-- ============================================================
-- Migration 018: 回覧板からの予定候補インポート + 記事リンク
--
-- デジタル回覧板アプリ（CC-SaaS）が抽出したイベント候補を受け取り、
-- 管理画面で承認して calendar_events(general) に反映するための
-- ステージングテーブルと、カレンダー→記事リンク用のカラムを追加。
-- ============================================================

-- カレンダーイベントに回覧板記事へのリンクを追加
alter table calendar_events add column if not exists article_url text;

-- 回覧板からの予定候補（ステージング）
CREATE TABLE IF NOT EXISTS general_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  title text NOT NULL,
  location text,
  start_time text,
  end_time text,
  article_url text,
  source text DEFAULT '回覧板',
  status text NOT NULL DEFAULT 'pending',  -- pending / applied / rejected
  applied_event_id uuid REFERENCES calendar_events(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_general_import_rows_status ON general_import_rows(status);

-- RLSポリシー: anonキーで読み書き可能（migration_017 と同じ方針）
ALTER TABLE general_import_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read general_import_rows" ON general_import_rows;
CREATE POLICY "Allow read general_import_rows" ON general_import_rows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow write general_import_rows" ON general_import_rows;
CREATE POLICY "Allow write general_import_rows" ON general_import_rows FOR ALL USING (true) WITH CHECK (true);
