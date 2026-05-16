ALTER TABLE booking_organizations
  ADD COLUMN IF NOT EXISTS group_name text;

-- 既存のcategoryカラムは利用区分tier(1-5)として使い続ける
-- group_nameが大カテゴリ（自治会、委員会、一般、その他/外部など）
