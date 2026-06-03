---
name: GAS/clasp作業の役割分担と制限
description: Claude Codeができること・できないこと。GASデプロイ、clasp、Webアプリ権限設定の制限事項。
type: reference
---

## Claude Codeができること

- GASコードの作成・編集（ローカル .gs ファイル）
- `clasp push` でGASにコードpush
- `clasp deploy` でデプロイ新規作成
- `clasp deployments` でデプロイ一覧確認
- `curl` でAPIの動作確認（GET）
- Google Driveファイル作成・読み取り（MCP経由）
- Pythonスクリプト作成・実行

## Claude Codeができないこと

- **Webアプリのアクセス権設定**（全員/自分のみ）→ clasp非対応、GASエディタUI操作が必要
- **デプロイのバージョン更新（権限維持）** → `clasp deploy -i` すると権限が消える
- **GASエディタでの手動操作** → ブラウザUI操作不可
- **スプレッドシートのシート構造作成** → Google Sheets APIの認証なし
- **GASの実行ログ確認** → GASエディタでしか見られない
- **GASの初回OAuth承認** → ブラウザで同意操作が必要

## 運用ルール

- コード変更 → `clasp push` → はなさんがGASエディタで「デプロイを管理 → 鉛筆 → 新バージョン → デプロイ」
- `clasp deploy -i` は使わない（権限が壊れるため）
- デプロイURLは変えずにバージョンだけ上げる
