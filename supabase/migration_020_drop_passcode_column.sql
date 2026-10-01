-- =====================================================
-- 団体テーブルから元のパスコード列を落とす
-- =====================================================
-- migration_019 でパスコードを booking_org_secrets に移し、
-- アプリ（api/auth.ts・管理画面の団体マスタ）を関数経由に切り替えて動作を確かめたあとに実行する。
--
-- この列が残っているあいだは、公開鍵で平文のパスコードが読めるままなので、
-- 切り替えが済んだら忘れずに実行する。
--
-- 実行前の確認:
--   SELECT count(*) FROM booking_org_secrets;            -- 移した件数
--   SELECT count(*) FROM booking_organizations
--     WHERE passcode IS NOT NULL AND btrim(passcode) <> '';  -- 元の件数（同じはず）
--
-- 実行手順: Supabase ダッシュボード → SQL Editor → 貼り付けて Run
-- =====================================================

ALTER TABLE booking_organizations DROP COLUMN IF EXISTS passcode;

SELECT count(*) AS 元の列が残っているか
FROM information_schema.columns
WHERE table_schema='public' AND table_name='booking_organizations' AND column_name='passcode';
