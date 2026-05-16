ALTER TABLE booking_organizations
  ADD COLUMN IF NOT EXISTS rep_last_name text,
  ADD COLUMN IF NOT EXISTS rep_first_name text,
  ADD COLUMN IF NOT EXISTS rep_last_name_kana text,
  ADD COLUMN IF NOT EXISTS rep_first_name_kana text;

-- 既存のrepresentativeデータを姓に移行（手動で名を分ける必要あり）
UPDATE booking_organizations SET rep_last_name = representative WHERE representative IS NOT NULL;
