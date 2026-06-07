# デザインシステム一覧

> 最終更新: 2026-06-07

## モード別フォントサイズ

### ユーザー側PC（EventList / Calendar）

| 要素 | サイズ | 色 |
|------|--------|-----|
| モード切替（カレンダー/会館予約） | text-base(16px) font-bold | gray-800 / gray-500 |
| ヘッダー年月 | text-lg(18px) font-bold | gray-800 |
| 曜日行 | text-sm(14px) font-bold | gray-600 / blue-500(土) / red-500(日) |
| セル内日付 | text-sm(14px) font-bold | gray-600 / blue-500(土) / red-500(日祝) |
| セル内イベント（主な予定） | text-sm(14px) font-bold | blue-700 on blue-100 |
| セル内イベント（詳細） | text-sm(14px) | gray-800 |
| セル内+N件 | text-sm(14px) | gray-400 |
| 凡例 | text-sm(14px) | gray-700 |
| 週ビュー日付 | text-lg(18px) font-bold | 同上曜日色 |
| 週ビューイベント | text-sm(14px) font-bold | gray-800 / blue-800(主な予定) |
| ポップオーバータイトル | text-base(16px) font-semibold | gray-900 |
| ポップオーバー本文 | text-sm(14px) | gray-600 |

### ユーザー側スマホ（MobileEventList / MobileCalendarView）

| 要素 | サイズ | 色 |
|------|--------|-----|
| タブボタン（カレンダー/会館予約） | text-base(16px) font-bold icon-18 | blue-600/emerald-600(active) / gray-600(inactive) |
| フィルタアイコン（ヘッダー右端） | icon-18 | gray-300 |
| ヘッダー年月 | text-xl(20px) font-bold | gray-800 |
| ナビ矢印 ◀▶ | icon-40 | gray-500 |
| 主な予定カード見出し | text-lg(18px) font-bold | blue-700 |
| 主な予定カード日付 | text-lg(18px) font-bold | 曜日色 |
| 主な予定カードタイトル | text-base(16px) font-bold | gray-800 |
| 日カード日付 | text-2xl(24px) font-bold | 曜日色 |
| 日カード曜日 | text-lg(18px) | 曜日色(薄) |
| TODAYバッジ | text-sm(14px) font-bold | white on blue-600 |
| 予定なし | text-sm(14px) | gray-400 |
| イベントタイトル | text-lg(18px) font-bold | gray-800 / blue-800 |
| イベント団体名 | text-base(16px) icon-14 | gray-500 (Usersアイコン付き) |
| イベント時間・場所 | text-base(16px) | gray-600 |
| 説明 | text-base(16px) | gray-500 |
| 会館予約スロット名 | text-lg(18px) font-bold | gray-600 |
| 会館予約イベント名 | text-lg(18px) | gray-800 |

### フィルタ ボトムシート（MobileOrgFilter）

| 要素 | サイズ | 色 |
|------|--------|-----|
| 見出し「表示する団体」 | text-base(16px) font-bold | gray-700 |
| 全選択/全解除 | text-sm(14px) font-bold | blue-500 |
| グループ名 | text-base(16px) | gray-700 |
| グループカウント | text-sm(14px) | gray-400 |
| 個別団体名 | text-sm(14px) | gray-600 |
| 未分類 | text-base(16px) | gray-500 |
| チェックボックス | w-5 h-5 | グループカラー |

### 管理画面PC（AdminDashboard）

| 要素 | サイズ | 色 |
|------|--------|-----|
| ヘッダータブ | text-sm(14px) font-medium | slate-400 / white |
| モード切替 | text-base(16px) font-bold | gray-800 / gray-500 |
| ビュー切替（月/週/一覧） | text-xs(12px) font-bold | gray-800 / gray-500 |
| 一覧テーブルヘッダー | text-xs(12px) font-bold | gray-500 |
| 一覧テーブル本文 | text-sm(14px) | gray-800 / gray-500 |
| ポップオーバー入力ラベル | text-xs(12px) font-medium | gray-500 |
| ポップオーバー入力 | text-sm(14px) | gray-800 |
| 団体マスタ検索ボックス | text-sm(14px) | gray-800 placeholder:gray-400 |
| インポート グループセレクタ | text-xs(12px) icon-13(Users) | gray-400 |
| インポート 団体セレクタ | text-xs(12px) | gray-400 |

---

## 色システム

### 曜日色分け（全モード共通）
| 曜日 | テキスト | テキスト(薄) |
|------|---------|-------------|
| 平日 | gray-800 | gray-400 |
| 土曜 | blue-500 | blue-400 |
| 日曜/祝日 | red-500 | red-400 |

### TODAY表示
| モード | 枠線 | 背景 | テキスト | バッジ |
|--------|------|------|---------|--------|
| ユーザーPC(カレンダー) | outline-blue-400 | — | blue-600 | — |
| ユーザーPC(会館予約) | outline-emerald-400 | — | emerald-600 on white | — |
| ユーザースマホ(カレンダー) | border-blue-400 ring-blue-200 | blue-50/50 | blue-600 | bg-blue-600 "TODAY" |
| ユーザースマホ(会館予約) | border-emerald-400 ring-emerald-200 | emerald-50/50 | emerald-600 | bg-emerald-600 "TODAY" |

### 主な予定ハイライト
| モード | 背景 | テキスト |
|--------|------|---------|
| PC月ビュー | bg-blue-100 | text-blue-700 |
| スマホ月/週ビュー | bg-blue-50 border-blue-200 | text-blue-800 |
| スマホ主な予定カード | bg-blue-50 border-blue-200 | — |

### 部屋カラー（全モード共通）
| 部屋 | ドット/バー色 |
|------|-------------|
| 会議室 | bg-yellow-400 |
| 和室（畳側） | bg-sky-400 |
| 和室（椅子側） | bg-sky-400 |
| 図書室 | bg-pink-400 |

### グループカラー（フィルタ共通）
| グループ | 色 |
|---------|-----|
| 自治会 | #ef4444 (red) |
| 委員会 | #3b82f6 (blue) |
| 自主活動部 | #10b981 (emerald) |
| 会員団体 | #f59e0b (amber) |
| 一般団体 | #8b5cf6 (violet) |
| その他/外部 | #9ca3af (gray-400) |
| 未分類 | #6b7280 (gray-500) |

### ポップオーバー背景
| 種類 | 背景 | 枠線 |
|------|------|------|
| カレンダーイベント（ユーザー） | bg-gray-50 | border-gray-200 |
| 会館予約（ユーザー） | bg-emerald-50 | border-emerald-200 |
| DetailPopover（管理/event） | bg-gray-50 | border-gray-200 |
| DetailPopover（管理/booking） | bg-gray-50 | border-gray-200 |
| BookingCreatePopover | bg-gray-50 | border-gray-200 |
| EventCreatePopover | bg-gray-50 | border-gray-200 |

---

## フィルタUI

### PC版サイドバー（OrgFilterSidebar）
| 要素 | サイズ | 色 |
|------|--------|-----|
| 「主な予定」トグル | text-sm font-bold | blue-700(on) / gray-400(off) |
| セクション見出し | text-sm font-bold | gray-500 |
| 全選択/全解除 | text-xs | blue-500 |
| グループ名 | text-sm font-medium | gray-700 |
| 団体名 | text-[13px] | gray-600 |
| 未分類 | text-sm font-medium | gray-400 |
| チェックボックス（グループ） | 18px | グループカラー |
| チェックボックス（団体） | 16px | グループカラー |

---

## ビュー構造

### 月ビュー

| モード | セル高さ | グリッド | 凡例 |
|--------|---------|---------|------|
| ユーザーPC(カレンダー) | min-h-[8rem] | 7cols | 主な予定 / 詳細予定 |
| ユーザーPC(会館予約) | min-h-[8rem] | 7cols, AM/PM分割 | 午前/午後 / 会議室/和室/図書室 |
| スマホ(カレンダー) | — | 縦並びカード（イベント0件のTODAYも表示） | — |
| スマホ(会館予約) | — | 縦並びカード | 会議室/和室/図書室 |

### 週ビュー

| モード | レイアウト | イベント表示項目 | 操作 |
|--------|----------|----------------|------|
| ユーザーPC(カレンダー) | 縦並びセクション | 時間・タイトル・場所・団体・説明2行 | クリック→ポップオーバー |
| ユーザーPC(会館予約) | 7列グリッド | スロット・タイトル・部屋バー | クリック→ポップオーバー |
| スマホ(カレンダー) | 縦並びカード | 時間・タイトル・場所・団体(Usersアイコン)・説明+続きを読む | スワイプ |
| スマホ(会館予約) | — （週ビューなし） | — | — |

### 一覧ビュー

| モード | カラム | 操作 |
|--------|--------|------|
| PC(カレンダー) | 日付/★/元タイトル/カレンダー用タイトル/時間/場所/⋮ | インライン編集、⋮→DetailPopover |
| PC(会館予約) | 日付/時間帯/部屋/団体/タイトル/⋮ | インライン編集、⋮→DetailPopover(即編集) |

---

## ボタン・トグル

| 要素 | PC | スマホ |
|------|-----|--------|
| モード切替 | text-base px-4 py-1.5 rounded-full (gray-100内) | text-base px-4 py-2 rounded-full (独立ピル) |
| ビュー切替 | text-xs px-3 py-1 rounded-full (gray-100内) | text-xs px-3 py-1 rounded-full |
| ナビ矢印 | p-2 size=20 | p-2 size=40 |
| フィルタ | サイドバー常時表示 | ヘッダー右端 icon-18 gray-300 → ボトムシート |
| ポップオーバー保存 | px-6 py-2 rounded-full emerald-600 | — |
| ポップオーバー閉じる | p-1.5 size=16 | — |

---

## 不整合メモ

| 項目 | 現状 | 備考 |
|------|------|------|
| TODAY色 | カレンダー=blue、会館予約=emerald | 意図的な色分けだが統一検討の余地あり |
| 管理画面スマホ対応 | なし（PC版をそのまま表示） | レスポンシブ未対応 |
| ビュー切替サイズ | PC text-xs / スマホ text-xs | モード切替(text-base)と差が大きい |
