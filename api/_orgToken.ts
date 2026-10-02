/**
 * 団体ログインの通行証（署名付き）
 *
 * これまでは { role, org_id, ... } を base64 にしただけで、署名も期限も無かった。
 * ブラウザのコンソールで自分で作れるので、誰でも「その団体として」振る舞えた。
 * 予約の申し込み窓口がこの通行証に繋がっているため、外から予約を作れる状態だった。
 *
 * ここでは本文に署名（HMAC-SHA256）を付け、期限も入れる。
 * 署名の鍵はサーバー側だけに置く（ORG_TOKEN_SECRET）。
 *
 * 形式: <本文のbase64url>.<署名のbase64url>
 *
 * 鍵が未設定のあいだは、これまでどおり署名なしでも受け付ける（移行のため）。
 * 鍵を設定すると、古い通行証は受け付けなくなり、団体は入り直しになる。
 * 詳細は CC-SaaS の docs/セキュリティ-RLS.md。
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.ORG_TOKEN_SECRET || '';

/** 通行証に入れる中身 */
export interface OrgTokenPayload {
  role: 'org';
  org_id: string;
  org_name: string;
  category?: string | null;
  /** 発行時刻（ミリ秒） */
  t: number;
}

/** 有効期間（30日） */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(bodyB64: string): string {
  return b64url(createHmac('sha256', SECRET).update(bodyB64).digest());
}

/** 通行証を作る */
export function issueOrgToken(payload: Omit<OrgTokenPayload, 't'>): string {
  const body = b64url(Buffer.from(JSON.stringify({ ...payload, t: Date.now() })));
  if (!SECRET) return body; // 鍵が無いあいだは署名なし（これまでと同じ形）
  return `${body}.${sign(body)}`;
}

/**
 * 通行証を確かめる。正しければ中身を返し、だめなら null。
 * 鍵が未設定のあいだは、署名が無くても中身が読めれば通す（移行のため）。
 */
export function verifyOrgToken(token: string | null | undefined): OrgTokenPayload | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body) return null;

  if (SECRET) {
    if (!sig) return null;
    const expected = sign(body);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  }

  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as OrgTokenPayload;
    if (payload?.role !== 'org' || !payload.org_id) return null;
    if (SECRET && (!payload.t || Date.now() - payload.t > MAX_AGE_MS)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** 署名の鍵が設定されているか（警告を出す判断に使う） */
export function orgTokenSecretConfigured(): boolean {
  return !!SECRET;
}
