ALTER TABLE booking_organizations
  ADD COLUMN IF NOT EXISTS registration_no text,
  ADD COLUMN IF NOT EXISTS furigana text,
  ADD COLUMN IF NOT EXISTS representative text,
  ADD COLUMN IF NOT EXISTS han_ko text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS activity_description text,
  ADD COLUMN IF NOT EXISTS has_monthly_fee boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS registration_date date;
