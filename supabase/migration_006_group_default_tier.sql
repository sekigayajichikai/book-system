ALTER TABLE booking_org_groups
  ADD COLUMN IF NOT EXISTS default_tier text DEFAULT '1';

UPDATE booking_org_groups SET default_tier = '1' WHERE name = '自治会';
UPDATE booking_org_groups SET default_tier = '1' WHERE name = '委員会';
UPDATE booking_org_groups SET default_tier = '2' WHERE name = '一般';
UPDATE booking_org_groups SET default_tier = '3' WHERE name = 'その他/外部';
UPDATE booking_org_groups SET default_tier = '1' WHERE name = '自主活動部';
