-- 場所マスタ（予定セクション用）
create table event_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- RLS
alter table event_locations enable row level security;
create policy "event_locations_read" on event_locations for select using (true);
create policy "event_locations_write" on event_locations for all using (true);

-- 初期データ
insert into event_locations (name, sort_order) values
  ('自治会館', 1),
  ('奥座公園', 2),
  ('草舞台公園', 3),
  ('西金沢コミュニティハウス', 4),
  ('ケアプラザ', 5);
