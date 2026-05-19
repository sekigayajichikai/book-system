CREATE TABLE calendar_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  event_time text,
  event_location text,
  display_start date NOT NULL,
  display_end date NOT NULL,
  style text DEFAULT 'green',
  image_url text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
