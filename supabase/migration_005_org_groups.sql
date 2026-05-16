CREATE TABLE booking_org_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

INSERT INTO booking_org_groups (name, sort_order) VALUES
  ('自治会', 1),
  ('委員会', 2),
  ('一般', 3),
  ('その他/外部', 4);
