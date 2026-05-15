-- 部屋マスタ
create table booking_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_name text not null,
  capacity integer default 0,
  description text default '',
  sort_order integer default 0,
  created_at timestamptz default now()
);

insert into booking_rooms (name, short_name, capacity, description, sort_order) values
  ('会議室', '会議室', 40, '大会議や集会に。', 1),
  ('和室（畳側）', '和室(畳)', 15, '床の間付き。', 2),
  ('和室（椅子側）', '和室(椅子)', 15, '', 3),
  ('図書室', '図書室', 10, '少人数の打ち合わせに。', 4);

-- 時間帯マスタ
create table booking_time_slots (
  id uuid primary key default gen_random_uuid(),
  slot_key text not null unique,
  label text not null,
  start_time time not null,
  end_time time not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

insert into booking_time_slots (slot_key, label, start_time, end_time, sort_order) values
  ('午前', '午前 9:00〜12:00', '09:00', '12:00', 1),
  ('午後', '午後 13:00〜16:00', '13:00', '16:00', 2),
  ('夜間', '夜間 17:00〜20:00', '17:00', '20:00', 3);

-- 設備マスタ
create table booking_equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price integer default 0,
  sort_order integer default 0,
  created_at timestamptz default now()
);

insert into booking_equipment (name, price, sort_order) values
  ('テレビ（またはスクリーンとして）', 300, 1),
  ('プロジェクター', 300, 2),
  ('スクリーン', 300, 3),
  ('アンプ・スピーカー・マイク', 300, 4),
  ('ブルーレイ・DVD・カセット', 300, 5),
  ('カラオケ（任天堂switch）', 300, 6),
  ('ノートパソコン', 300, 7),
  ('外付けディスプレー', 300, 8);

-- 利用区分マスタ
create table booking_usage_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier text not null,
  price_type text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

insert into booking_usage_categories (name, tier, price_type, sort_order) values
  ('① 自治会運営・各部の会議', '1', 'free', 1),
  ('② 会員の趣味・同好会・親睦', '2', 'hobby', 2),
  ('③ 混成団体・教室', '3', 'class', 3),
  ('④ 弔事の宿泊', '4', 'stay', 4),
  ('⑤ その他', '5', 'other', 5);

-- 団体マスタ
create table booking_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  passcode text,
  contact_email text,
  default_equipment text[] default '{}',
  presets text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 予約テーブル
create table bookings (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  slot text not null,
  room text not null,
  title text not null,
  org_id uuid references booking_organizations(id),
  status text not null default 'CONFIRMED',
  category text,
  equipment text[] default '{}',
  price integer default 0,
  memo text,
  created_by text,
  approved_by text,
  approved_at timestamptz,
  reject_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 日付+スロット+部屋の重複防止
create unique index bookings_unique_slot
  on bookings(date, slot, room)
  where status in ('CONFIRMED', 'PENDING');

-- カレンダーイベント（予約以外の自治会イベント）
create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  title text not null,
  location text,
  start_time time,
  end_time time,
  memo text,
  is_announcement boolean default false,
  announcement_text text,
  created_at timestamptz default now()
);
