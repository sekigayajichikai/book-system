import { RoomType } from './types';

export const ROOMS = [
  { id: RoomType.KAIGISHITSU, name: '会議室', capacity: 40, description: '大会議や集会に。' },
  { id: RoomType.WASHITSU_TATAMI, name: '和室（畳側）', capacity: 15, description: '床の間付き。' },
  { id: RoomType.WASHITSU_ISU, name: '和室（椅子側）', capacity: 15, description: '' },
  { id: RoomType.TOSHOSHITSU, name: '図書室', capacity: 10, description: '少人数の打ち合わせに。' },
];

export const TIME_SLOTS = [
  { id: 'morning', label: '午前 9:00〜12:00', startTime: '09:00', endTime: '12:00' },
  { id: 'afternoon', label: '午後 13:00〜16:00', startTime: '13:00', endTime: '16:00' },
  { id: 'night', label: '夜間 17:00〜20:00', startTime: '17:00', endTime: '20:00' },
];

export const USAGE_CATEGORIES = [
  { id: 'official', name: '① 自治会運営・会合', priceType: 'free' },
  { id: 'member_hobby', name: '② 会員の趣味・親睦', priceType: 'hobby' },
  { id: 'mixed_class', name: '③ 混合団体・教室', priceType: 'class' },
  { id: 'stay', name: '④ 慶弔宿泊', priceType: 'stay' },
];

export const EQUIPMENT_ITEMS = [
  { id: 'tv', name: 'テレビ（スクリーン利用）', price: 300 },
  { id: 'projector', name: 'プロジェクター', price: 300 },
  { id: 'screen', name: 'スクリーン', price: 300 },
  { id: 'sound', name: 'アンプ・スピーカー・マイク', price: 300 },
  { id: 'media', name: 'BD/DVD/CD/カセット', price: 300 },
  { id: 'karaoke', name: 'カラオケ（Wii U）', price: 300 },
  { id: 'pc', name: 'ノートパソコン', price: 300 },
];

export const getPrice = (categoryId: string, roomType: RoomType, equipmentIds: string[] = []): number => {
  let total = equipmentIds.length * 300;

  const category = USAGE_CATEGORIES.find(c => c.id === categoryId);
  if (!category) return total;

  if (category.priceType === 'free') return total;
  if (category.priceType === 'stay') return total + 1000;

  const isLarge = roomType === RoomType.KAIGISHITSU;

  if (category.priceType === 'hobby') {
    total += isLarge ? 200 : 100;
  } else if (category.priceType === 'class') {
    total += isLarge ? 500 : 200;
  }

  return total;
};
