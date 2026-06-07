# DB・API マップ

> **関ヶ谷自治会 会館予約・カレンダーシステム**
> 作成日: 2026-06-03 / 最終更新: 2026-06-07b
> 対象プロジェクト: `sekigayajichikai/book-system`
> DB: Supabase (PostgreSQL) / ホスティング: Vercel

---

## このドキュメントについて

本システムは自治会館の予約管理と地域カレンダーを提供するWebアプリです。
このドキュメントでは以下をまとめています:

1. **データベース構造** — どんなテーブルがあり、どう繋がっているか
2. **データアクセス経路** — 画面の操作がどうやってDBに届くか
3. **各テーブルの詳細** — カラムの意味と制約
4. **API一覧** — サーバー側の処理窓口
5. **フロント直接アクセス一覧** — ブラウザから直接DBを触る処理

### 用語

| 用語 | 意味 |
|------|------|
| **テーブル** | データを行と列で管理する入れ物。Excelのシートに近い |
| **カラム** | テーブルの列。「日付」「タイトル」など |
| **レコード** | テーブルの1行。1件の予約、1件のイベントなど |
| **PK** (Primary Key) | 各行を一意に識別するID。重複しない |
| **FK** (Foreign Key) | 他テーブルのIDを参照して紐づける仕組み。例: 予約→団体 |
| **R/C/U/D** | Read(読む) / Create(作る) / Update(更新) / Delete(削除) |
| **API** | サーバー上の処理窓口。ブラウザが `/api/xxx` にリクエストを送ると、サーバーがDBを操作して結果を返す |

---

## データアクセスの2つの経路

このシステムでは、ブラウザからDBにアクセスする経路が2種類あります。

### 経路1: API経由（サーバーを通す）

```
ブラウザ → Vercelサーバー(/api/xxx) → Supabase DB
```

- `/api/events`, `/api/booking` など
- サーバー側でデータの加工・結合・バリデーションを行う
- 複雑な処理（インポート、複数テーブルの結合）はこちら
- **例**: カレンダータブを開く → `/api/events?year=2026&month=6` → サーバーが calendar_events と bookings を結合して返す

### 経路2: フロント直接（サーバーを通さない）

```
ブラウザ → Supabase DB（直接）
```

- ブラウザのJavaScriptからSupabaseのREST APIを直接呼ぶ
- 単純な読み書き（1テーブルの取得・更新・削除）はこちら
- 管理画面のポップオーバー内の編集・削除など、即時反映が必要な操作に使用
- **例**: ポップオーバーで予約のタイトルを変更 → ブラウザから直接 `bookings` テーブルをUPDATE

### なぜ2種類あるのか

| 経路 | メリット | 使う場面 |
|------|---------|---------|
| API経由 | サーバーで複雑な処理ができる。セキュリティ的に安全 | データ取得、インポート、同期 |
| フロント直接 | 即座に反映できる。コードがシンプル | 管理画面の編集・削除・マスタ管理 |

---

## ER図（テーブル関係）

テーブル同士がどう繋がっているかの図です。矢印はFK（外部キー）による紐づけを表します。

```
┌─────────────────────┐
│ booking_org_groups   │  団体の大カテゴリ（自治会/委員会/一般等）
│ name, default_tier   │
└──────┬──────────────┘
       │ group_name で参照
       ▼
┌─────────────────────────────┐
│ booking_organizations        │  団体マスタ（トーンチャイム、カラオケ愛好会等）
│ name, group_name, passcode   │
└──┬───────────────┬──────────┘
   │ org_id FK      │ org_id FK
   ▼                ▼
┌──────────┐  ┌────────────────┐
│ bookings  │  │ calendar_events │
│ 会館予約   │  │ カレンダー予定    │
│ date,slot │  │ date,title      │
│ room,title│  │ event_type      │
└──┬────────┘  └────────────────┘
   │ event_id FK         ▲
   └─────────────────────┘
     会館予約 → カレンダー予定に紐づく
     （1つの予定に複数の予約が紐づくことがある）

┌──────────────┐     ┌─────────────┐
│ import_batches│ ←── │ import_rows  │  Excelインポートの差分管理
│ (月ごとの取込) │     │ (行ごとの差分) │
└──────────────┘     └─────────────┘

独立マスタテーブル（他から参照されない設定データ）:
  event_locations      … 場所（自治会館/公園等）
  booking_rooms        … 部屋（会議室/和室/図書室）
  booking_time_slots   … 時間帯（午前/午後/夜間）
  booking_equipment    … 設備（プロジェクター等）
  booking_usage_categories … 利用区分（自治会運営/趣味等）
  app_settings         … アプリ設定（Google DriveファイルID等）
```

### 団体名の取得元（重要）

画面に表示される「団体名」は、イベントの種類によって取得元が異なる:

```
■ 会館予約由来のイベント（event_type = facility）
  bookings.org_id → booking_organizations.name
  （予約テーブルのFK経由で団体マスタから取得）

■ 一般予定（event_type = general）
  calendar_events.org_id → booking_organizations.name（FK紐づけ）
  calendar_events.memo  （表示用テキスト。org_idと同時に保存される）

■ カレンダーAPI (/api/events) での優先順位:
  1. calendar_events.memo    ← あればこれを使う
  2. bookings.org_id の団体名  ← memoが空なら紐づく予約から取得
  3. null                     ← どちらも無ければ「未分類」
```

つまり:
- **会館予約** → `bookings.org_id`（FK紐づけ）
- **一般予定** → `calendar_events.org_id`（FK紐づけ）+ `memo`（表示用テキスト）
- どちらも団体マスタへのFK参照で管理される

### データの流れ（具体例）

**1. 会館予約を作成する場合:**
管理画面で空セルクリック → BookingCreatePopoverが開く → 団体・時間帯・部屋を入力して保存
→ `calendar_events` に facility型イベントが1件作成される
→ `bookings` に予約が1件作成され、`event_id` でイベントに紐づく

**2. 一般予定を作成する場合（防災訓練、清掃等）:**
管理画面のカレンダーで空セルクリック → EventCreatePopoverが開く → タイトル・場所・時間を入力
→ `calendar_events` に general型イベントが1件作成される（bookingsには何も入らない）

**3. Excelインポートの場合:**
管理画面の「インポート」タブでExcel選択 → サーバーが既存予約と差分計算
→ `import_batches` にバッチ1件 + `import_rows` に行ごとの差分が保存される（まだ本番には反映しない）
→ 事務局が差分を確認して承認 → `/api/import-apply` が `bookings` と `calendar_events` に反映

**4. 住民がカレンダーを見る場合:**
ブラウザでサイトを開く → `/api/events?year=2026&month=6` をリクエスト
→ サーバーが `calendar_events` から6月のイベントを取得
→ facility型のイベントは `bookings` から部屋・時間帯の情報も結合して返す

---

## テーブル一覧

### bookings（会館予約）

自治会館の部屋予約。**1レコード = 1日 × 1時間帯 × 1部屋**。
例: 6月3日の午後に会議室を予約 = 1レコード。同じ団体が午前と午後を予約すれば2レコード。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid PK | 自動生成される一意のID |
| date | date | 予約日（2026-06-03等） |
| slot | text | 時間帯（午前/午後/夜間） |
| room | text | 部屋名（会議室/和室（畳側）/和室（椅子側）/図書室） |
| title | text | 予約タイトル（通常は団体名が入る） |
| org_id | uuid FK → booking_organizations | どの団体の予約か |
| event_id | uuid FK → calendar_events | 住民カレンダー上のどのイベントに紐づくか |
| status | text | 状態: CONFIRMED(確定) / PENDING(承認待ち) / REJECTED(却下) / CANCELLED(キャンセル) |
| category | text | 利用区分（1〜5。料金計算に使用） |
| equipment | text[] | 利用する設備のリスト（テレビ, プロジェクター等） |
| price | integer | 計算された料金（円） |
| memo | text | メモ・補足情報 |
| created_by | text | 作成者（将来の操作ログ用） |
| approved_by | text | 承認した人 |
| approved_at | timestamptz | 承認日時 |
| reject_reason | text | 却下された場合の理由 |
| created_at | timestamptz | レコード作成日時 |
| updated_at | timestamptz | 最終更新日時 |

**重要な制約:** 同じ日・同じ時間帯・同じ部屋には、確定(CONFIRMED)または承認待ち(PENDING)の予約は1件しか入れられない。重複するとエラーになる。

### calendar_events（カレンダーイベント）

住民向けカレンダーに表示されるイベント。3種類の `event_type` がある:
- **general**: 一般予定（防災訓練、清掃等）。会館予約とは無関係
- **facility**: 会館予約から自動生成されたイベント。bookingsと`event_id`で紐づく
- **closure**: 休館日

| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid PK | 自動生成 |
| date | date | 日付 |
| title | text | タイトル（facility型の場合は団体名やサークル名等） |
| display_title | text | カレンダー用の別名（任意。住民に見せたい名前が元タイトルと違う場合に設定） |
| event_type | text | general(一般) / facility(会館予約由来) / closure(休館日) |
| visibility | text | public(住民に公開) / internal(事務局のみ) |
| location | text | 場所（自治会館、奥座公園等） |
| start_time | time | 開始時間（09:00等） |
| end_time | time | 終了時間（12:00等） |
| memo | text | 団体名（一般予定で団体を記録する場合に使用） |
| description | text | 説明文（住民向けの補足情報） |
| org_id | uuid FK → booking_organizations | 紐づく団体（任意） |
| is_major | boolean | 主な予定フラグ（trueだとカレンダーで色付き強調表示される） |
| is_closure | boolean | 休館日フラグ |
| created_at | timestamptz | 作成日時 |
| updated_at | timestamptz | 更新日時 |

### booking_organizations（団体マスタ）

会館を利用する団体の情報。管理画面の「団体マスタ」タブで管理。
将来的に団体ごとのログイン機能（Phase 3）のパスコードも保持している。

| カラム | 型 | 説明 |
|--------|-----|------|
| id | uuid PK | 自動生成 |
| name | text | 団体名（例: トーンチャイムサークル） |
| group_name | text | 大カテゴリ（自治会/委員会/自主活動部/会員団体/一般/その他） |
| category | text | 利用区分tier（1=無料〜5=その他。料金に影響） |
| passcode | text | 団体ログイン用パスコード（将来Phase 3で使用） |
| furigana | text | フリガナ |
| representative | text | 代表者名（姓名結合済み） |
| rep_last_name / rep_first_name | text | 代表者の姓・名 |
| rep_last_name_kana / rep_first_name_kana | text | 代表者の姓名カナ |
| han_ko | text | 班-戸番（例: 3-12） |
| phone | text | 電話番号 |
| contact_email | text | メールアドレス |
| activity_description | text | 活動内容の説明 |
| has_monthly_fee | boolean | 月謝がある団体か（利用区分の自動判定に影響） |
| registration_no | text | 登録番号 |
| registration_date | date | 登録年月日 |
| default_equipment | text[] | よく使う設備（予約作成時にデフォルトで選択される） |
| presets | text[] | 活動プリセット |
| is_active | boolean | 表示設定。true=常に表示、false=非表示、null=自動判定（6ヶ月以内に利用あれば表示） |
| keywords | text[] | Excelインポート時にタイトルから自動で団体を紐づけるためのキーワード |
| notes | text | 自由メモ（管理者用） |

### booking_org_groups（団体グループ）

団体の大カテゴリマスタ。管理画面の団体編集や、予約作成時の団体選択UIの1段目ドロップダウンで使用。

| カラム | 型 | 初期値 |
|--------|-----|--------|
| id | uuid PK | 自動生成 |
| name | text UNIQUE | 自治会 / 委員会 / 自主活動部 / 一般 / その他・外部 |
| default_tier | text | 各グループのデフォルト利用区分（1〜3） |
| sort_order | integer | 表示順 |

### マスタテーブル（設定データ）

管理画面の「設定」タブから追加・編集・削除・並び替えが可能。
アプリの選択肢（部屋の候補、時間帯の候補等）を定義している。

| テーブル | 用途 | 初期値例 |
|---------|------|---------|
| booking_rooms | 部屋の候補 | 会議室(定員40), 和室畳(15), 和室椅子(15), 図書室(10) |
| booking_time_slots | 時間帯の候補 | 午前 9:00-12:00, 午後 13:00-16:00, 夜間 17:00-20:00 |
| booking_equipment | 貸出設備の候補と料金 | テレビ, プロジェクター, カラオケ等（各300円） |
| booking_usage_categories | 利用区分と料金体系 | ①自治会運営(無料), ②趣味(大200/小100円), ③教室(大500/小200円)等 |
| event_locations | イベントの場所の候補 | 自治会館, 奥座公園, 草舞台公園, 西金沢コミュニティハウス, ケアプラザ |

### app_settings（アプリ設定）

アプリ全体の設定をキーバリューで保存。管理画面から変更可能。

| カラム | 型 | 説明 |
|--------|-----|------|
| key | text PK | 設定キー |
| value | text | 設定値 |
| updated_at | timestamptz | 更新日時 |

現在の設定値:

| key | 用途 |
|-----|------|
| drive_file_id | Google Driveインポート対象ファイルのID。管理画面の「接続先を変更」から変更可能 |

### import_batches / import_rows（インポート管理）

Excelファイルからの会館予約データ取込を管理する。
いきなり本番に反映するのではなく、ステージング → 差分確認 → 承認反映の3段階で安全に取り込む。

| テーブル | 主要カラム | 説明 |
|---------|-----------|------|
| import_batches | source_file, target_year/month, status, stats | 月ごとのインポートバッチ。status: pending(取込済)→reviewing(確認中)→applied(反映済) |
| import_rows | batch_id(FK), date, slot, room, title, diff_type, review_status | 行ごとの差分。diff_type: add(新規)/update(変更)/delete(削除)/skip(変更なし)/title_diff(タイトルのみ違う) |

---

## API エンドポイント一覧

APIエンドポイントは、ブラウザがサーバーにデータを要求する「窓口」です。
`/api/xxx` というURLにリクエストを送ると、サーバーがDBを操作して結果をJSON形式で返します。

### 認証・マスタ系

| エンドポイント | メソッド | テーブル | 説明 |
|--------------|---------|---------|------|
| `/api/auth` | POST | booking_organizations(R) | ログイン認証。事務局は環境変数のパスワード照合、団体は名前+パスコード照合 |
| `/api/masters` | GET | 全マスタ(R) | 団体・部屋・時間帯・設備・利用区分・場所を一括で返す。フロントの選択肢表示に使用（1時間キャッシュ） |
| `/api/holidays` | GET | 外部API | Google CalendarのiCalフィードから日本の祝日を取得して返す（24時間キャッシュ） |

### 表示系（住民・事務局がカレンダーを見る時に呼ばれる）

| エンドポイント | メソッド | テーブル | 説明 |
|--------------|---------|---------|------|
| `/api/bookings-view` | GET | bookings(R), booking_time_slots(R) | 指定月の会館予約を取得。会館予約タブのカレンダー表示に使用。時間帯マスタで午前/午後/夜間のラベルを付与 |
| `/api/events` | GET | calendar_events(R), bookings(R) | 指定月のイベント一覧を取得。住民向けカレンダータブに使用。facility型イベントは bookings から部屋名・時間帯も結合して返す |

### 予約操作系

| エンドポイント | メソッド | テーブル | 説明 |
|--------------|---------|---------|------|
| `/api/booking` | POST | bookings(C) | 新規予約を1件作成。同じ日・時間帯・部屋に既予約がある場合は23505エラー（重複）で失敗 |

### インポート系（Excelからの予約データ取込）

| エンドポイント | メソッド | テーブル | 説明 |
|--------------|---------|---------|------|
| `/api/import` | POST | import_batches(C), import_rows(C) | Excelの行データを受け取り、既存予約との差分を計算してステージング保存。まだ本番には反映しない |
| `/api/import` | GET | import_batches(R), import_rows(R) | ステージング中のデータを取得。管理画面の「インポート」タブで差分確認に使用 |
| `/api/import` | PATCH | import_rows(U) | 各行の承認/スキップを更新。事務局が1行ずつ確認して承認 or スキップする |
| `/api/import` | DELETE | import_batches(D), import_rows(D) | バッチごと削除。import_rowsはCASCADEで自動削除される |
| `/api/import-apply` | POST | bookings(CUD), calendar_events(CUD) | 承認済みの行を本番テーブルに反映。add→INSERT、update→UPDATE、delete→DELETE |

### 外部同期系（Google Drive/スプレッドシートからの自動取込）

| エンドポイント | メソッド | テーブル | 説明 |
|--------------|---------|---------|------|
| `/api/sync-drive` | POST | import系 → bookings, calendar_events | 自治会館PCのGoogle Drive上のExcelファイルを取得→解析→差分処理→反映。自動スケジュール可能 |
| `/api/sync-drive` | GET | app_settings(R),（外部: Google Drive API） | DriveファイルのファイルID・最終更新日時・オーナー名を取得。インポートタブの接続先表示に使用 |
| `/api/sync-drive` | PATCH | app_settings(U) | 接続先DriveファイルIDを変更。管理画面の「接続先を変更」UIから呼ばれる |
| `/api/sync-general` | POST | calendar_events(CU) | Googleスプレッドシート(CSV形式)から一般予定を取込。タイトル・場所・時間・主な予定フラグ・休館日を読み取る |

---

## フロント直接アクセス一覧

以下はブラウザのJavaScriptからSupabaseのDBを**サーバーを経由せず直接**読み書きしている処理です。
管理画面のポップオーバー内の編集・マスタ管理など、即時反映が必要な操作に使っています。

### 読み取り（R）— データを取得するだけ

| コンポーネント | テーブル | どんな時に呼ばれるか |
|--------------|---------|-------------------|
| OrgPicker | booking_org_groups, booking_organizations | 予約作成/編集・一般予定編集で団体を選択する時（グループ→団体の2段階ドロップダウン） |
| OrgFilterSidebar | booking_org_groups, booking_organizations, bookings | PC版カレンダーの団体フィルタ表示（グループ→団体のチェックボックス） |
| MobileOrgFilter | booking_org_groups, booking_organizations | スマホ版カレンダーの団体フィルタ（ボトムシート） |
| DetailPopover | event_locations | イベント編集で場所を選ぶ時（セレクトボックスの選択肢） |
| DetailPopover | bookings → booking_organizations | 予約の詳細を開いた時（団体名を取得） |
| DetailPopover | booking_organizations | 一般予定編集で団体名からorg_idを検索 |
| EventList | bookings → booking_organizations | カレンダーの予約クリック時（facility型イベントの団体名を取得） |
| Calendar | bookings → booking_organizations | 会館予約カレンダーの一覧表示時（各予約の団体名マッピング） |
| AdminDashboard | calendar_events | ページ読み込み時（休館日の一覧を取得） |
| AdminDashboard | bookings → booking_organizations | 会館予約タブで予約クリック時（団体名を取得） |
| MyPage | bookings | 団体ログイン後のマイページ（自分の予約一覧を表示） |

### 作成（C）— 新しいデータを追加

| コンポーネント | テーブル | どんな時に呼ばれるか |
|--------------|---------|-------------------|
| BookingCreatePopover | calendar_events + bookings | 管理画面で会館予約を新規作成（facility型イベントも同時作成） |
| EventCreatePopover | calendar_events | 管理画面で一般予定を新規作成 |
| EventCreatePopover | calendar_events | 管理画面で休館日を設定 |

### 更新（U）— 既存データを変更

| コンポーネント | テーブル | どんな時に呼ばれるか |
|--------------|---------|-------------------|
| DetailPopover | calendar_events | イベントのタイトル・時間・説明・display_title・主な予定フラグ・団体(memo+org_id)を変更 |
| DetailPopover | bookings | 予約のタイトル・時間帯・部屋・団体・メモを変更 |
| Calendar(BookingSheetView) | bookings | 会館予約の一覧ビューでタイトル・団体をインライン編集 |
| EventList(EventSheetView) | bookings + calendar_events | カレンダーの一覧ビューで時間帯・部屋をインライン編集 |
| SettingsTab | 全マスタテーブル | 管理画面の「設定」タブでマスタデータを編集・並び替え |

### 削除（D）— データを消す

| コンポーネント | テーブル | どんな時に呼ばれるか |
|--------------|---------|-------------------|
| DetailPopover | calendar_events | イベントのゴミ箱アイコンクリック |
| DetailPopover | bookings (+calendar_events) | 予約のゴミ箱アイコンクリック。紐づく予約が0件になったイベントも自動削除 |
| EventCreatePopover | calendar_events | 休館日を解除した時 |
| AdminDashboard | booking_organizations | 団体マスタの削除。予約データが紐づいている場合はDELETE失敗→is_active=falseに変更（アーカイブ） |
| SettingsTab | マスタテーブル | 管理画面の「設定」タブでマスタデータを削除 |
