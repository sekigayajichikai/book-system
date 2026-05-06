import { RoomType } from './types';

export const ROOMS = [
  { id: RoomType.ROOM_1F, name: '1F会議室', capacity: 40, description: '約30畳。大会議や集会に。' },
  { id: RoomType.ROOM_SMALL, name: '小会議室', capacity: 10, description: '少人数の打ち合わせに。' },
  { id: RoomType.JAPANESE_1, name: '和室（１）', capacity: 15, description: '床の間付き。' },
  { id: RoomType.JAPANESE_2, name: '和室（２）', capacity: 15, description: 'クリエイト側。' },
];

export const TIME_SLOTS = [
  { id: 'morning', label: '9:00 ~ 12:00', startTime: '09:00', endTime: '12:00' },
  { id: 'afternoon', label: '13:00 ~ 16:00', startTime: '13:00', endTime: '16:00' },
  { id: 'night', label: '17:00 ~ 21:00', startTime: '17:00', endTime: '21:00' },
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
  let total = 0;

  // Equipment Fee
  const equipmentFee = equipmentIds.length * 300;
  total += equipmentFee;

  // Usage Fee
  const category = USAGE_CATEGORIES.find(c => c.id === categoryId);
  if (!category) return total;
  
  if (category.priceType === 'free') return total; // Equipment fee might still apply? Assuming equipment fee is separate.
  // Assuming Equipment fee applies even if room is free, unless specified otherwise. 
  // If "Free" means totally free, we should change this. 
  // Usually usage fee is free, but equipment is paid. Keeping it additive.
  
  if (category.priceType === 'stay') {
    total += 1000;
    return total;
  }
  
  const isLarge = roomType === RoomType.ROOM_1F;
  
  if (category.priceType === 'hobby') {
    total += isLarge ? 200 : 100;
  } else if (category.priceType === 'class') {
    total += isLarge ? 500 : 200;
  }
  
  return total;
};

export const HALL_RULES = `
自治会館利用規約（要約）:
1. 利用時間は午前9時から午後9時までです。
2. 3つの時間枠（午前・午後・夜間）で予約を受け付けています。
3. 料金は利用目的と部屋によって異なります。
   - 自治会運営: 無料
   - 会員の趣味: 1F会議室200円、他100円
   - 教室・混合団体: 1F会議室500円、他200円
   - 宿泊: 一律1,000円
4. 電子機器（プロジェクター、カラオケ等）の利用は1点につき300円かかります。
5. 近隣の迷惑になるような騒音は禁止です。
6. 予約キャンセルは3日前までに行ってください。
7. 使用後は清掃と戸締りをお願いします。
`;