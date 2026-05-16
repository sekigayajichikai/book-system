ALTER TABLE booking_usage_categories
  ADD COLUMN IF NOT EXISTS price_large integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_small integer DEFAULT 0;

-- 初期値を設定
UPDATE booking_usage_categories SET price_large = 0, price_small = 0 WHERE price_type = 'free';
UPDATE booking_usage_categories SET price_large = 200, price_small = 100 WHERE price_type = 'hobby';
UPDATE booking_usage_categories SET price_large = 500, price_small = 200 WHERE price_type = 'class';
UPDATE booking_usage_categories SET price_large = 1000, price_small = 1000 WHERE price_type = 'stay';
UPDATE booking_usage_categories SET price_large = 0, price_small = 0 WHERE price_type = 'other';
