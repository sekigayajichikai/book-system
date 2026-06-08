import { describe, it, expect } from 'vitest';
import { shortRoomName } from './constants';
import { RoomType } from './types';

// 部屋名を短縮表示に変換する純粋関数のテスト。
// 「入力 → 期待する出力」を宣言するだけで、関数の仕様が読めるドキュメントにもなる。
describe('shortRoomName', () => {
  it('正式名称を短縮名に変換する', () => {
    expect(shortRoomName('会議室')).toBe('会議室');
    expect(shortRoomName('和室（畳側）')).toBe('和室(畳)');
    expect(shortRoomName('和室（椅子側）')).toBe('和室(椅子)');
    expect(shortRoomName('図書室')).toBe('図書室');
  });

  it('RoomType enum の値を渡しても短縮名を返す', () => {
    // ROOMS の id は RoomType の値（＝正式名称）。enum 経由でも引けることを確認する。
    expect(shortRoomName(RoomType.WASHITSU_TATAMI)).toBe('和室(畳)');
  });

  it('未知の名前はそのまま返す（フォールバック）', () => {
    expect(shortRoomName('存在しない部屋')).toBe('存在しない部屋');
    expect(shortRoomName('')).toBe('');
  });
});
