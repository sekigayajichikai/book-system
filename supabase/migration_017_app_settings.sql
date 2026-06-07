-- ============================================================
-- Migration 017: アプリ設定テーブル
--
-- Google DriveファイルIDなどの管理者設定を保存
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- RLSポリシー: anonキーで読み書き可能
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read app_settings" ON app_settings;
CREATE POLICY "Allow read app_settings" ON app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow write app_settings" ON app_settings;
CREATE POLICY "Allow write app_settings" ON app_settings FOR ALL USING (true) WITH CHECK (true);

-- 初期値: Google DriveファイルID
INSERT INTO app_settings (key, value) VALUES
  ('drive_file_id', '1i7e4xbTqsUqseRS5NBQftZY61BoKDjcJ')
ON CONFLICT (key) DO NOTHING;
