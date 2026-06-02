-- カレンダー用表示タイトル（住民に見せる名前）
alter table calendar_events add column display_title text;

-- 既存データ: display_titleはnullのまま（= titleがそのまま使われる）
