-- =====================================================
-- 団体のパスコードを公開鍵から読めない場所へ移す
-- =====================================================
-- これまで booking_organizations.passcode に平文で入っていた。
-- このテーブルは公開鍵（anon key）で全列が読めるので、公開サイトの JavaScript から
-- 取り出した鍵1本で、全団体のパスコードがそのまま手に入る状態だった。
--
-- パスコードを別テーブルに移し、そのテーブルは公開鍵から一切触れないようにする。
-- 読み書きは「中だけ特権で動く関数」（SECURITY DEFINER）を通してのみ行う。
--
-- 注意: この時点ではまだ Supabase Auth を入れていないので、パスコードを「設定する」関数は
-- 公開鍵からも呼べる（＝これまでと同じ権限）。読めなくなることが今回の利得。
-- Auth を入れたあと、set_org_passcode の実行権限をログイン済みだけに絞る。
--
-- 実行手順: Supabase ダッシュボード → SQL Editor → このファイル全体を貼り付けて Run
-- =====================================================

-- 1) パスコードの置き場
CREATE TABLE IF NOT EXISTS booking_org_secrets (
  org_id     UUID PRIMARY KEY REFERENCES booking_organizations(id) ON DELETE CASCADE,
  passcode   TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE booking_org_secrets IS '団体ログインのパスコード。公開鍵からは読めない（RLS有効・ポリシーなし）';

-- 2) いま入っているパスコードを移す
INSERT INTO booking_org_secrets (org_id, passcode)
SELECT id, btrim(passcode) FROM booking_organizations
WHERE passcode IS NOT NULL AND btrim(passcode) <> ''
ON CONFLICT (org_id) DO NOTHING;

-- 3) 公開鍵からも、ログイン済みからも触れないようにする（ポリシーを1つも置かない）
ALTER TABLE booking_org_secrets ENABLE ROW LEVEL SECURITY;

-- 4) 照合する関数（中は所有者の権限で動くので、上のテーブルを読める）
CREATE OR REPLACE FUNCTION verify_org_passcode(p_org_name TEXT, p_passcode TEXT)
RETURNS TABLE (id UUID, name TEXT, category TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.name, o.category
  FROM booking_organizations o
  JOIN booking_org_secrets s ON s.org_id = o.id
  WHERE o.name = p_org_name
    AND s.passcode = p_passcode;
$$;

-- 5) パスコードを設定・解除する関数（空文字や NULL を渡すと解除）
CREATE OR REPLACE FUNCTION set_org_passcode(p_org_id UUID, p_passcode TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_passcode IS NULL OR btrim(p_passcode) = '' THEN
    DELETE FROM booking_org_secrets WHERE org_id = p_org_id;
  ELSE
    INSERT INTO booking_org_secrets (org_id, passcode, updated_at)
    VALUES (p_org_id, btrim(p_passcode), NOW())
    ON CONFLICT (org_id) DO UPDATE SET passcode = EXCLUDED.passcode, updated_at = NOW();
  END IF;
END;
$$;

-- 6) 設定されているかどうかだけを返す関数（管理画面の表示用。中身は返さない）
CREATE OR REPLACE FUNCTION has_org_passcode(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM booking_org_secrets WHERE org_id = p_org_id);
$$;

-- 7) 実行できる相手をはっきりさせる
REVOKE ALL ON FUNCTION verify_org_passcode(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_org_passcode(UUID, TEXT)    FROM PUBLIC;
REVOKE ALL ON FUNCTION has_org_passcode(UUID)          FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_org_passcode(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION has_org_passcode(UUID)          TO anon, authenticated;
-- 設定は、Auth を入れたら authenticated だけに絞る（いまは今までと同じ権限のまま）
GRANT EXECUTE ON FUNCTION set_org_passcode(UUID, TEXT)    TO anon, authenticated;

-- 8) 確認（件数だけ。中身は出さない）
SELECT (SELECT count(*) FROM booking_org_secrets) AS パスコード件数;

-- 元の列（booking_organizations.passcode）を落とすのは、アプリを新しい方式に切り替えて
-- 動作を確かめたあと。migration_020_drop_passcode_column.sql で行う。
