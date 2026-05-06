export enum RoomType {
  ROOM_1F = '1F会議室',
  ROOM_SMALL = '小会議室',
  JAPANESE_1 = '和室（１）',
  JAPANESE_2 = '和室（２）'
}

export enum BookingStatus {
  CONFIRMED = 'CONFIRMED',
  PENDING = 'PENDING',
  CANCELLED = 'CANCELLED'
}

export interface Booking {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  room: RoomType;
  applicantName: string;
  purpose: string;
  category: string;
  equipment: string[]; // List of equipment IDs
  price: number;
  status: BookingStatus;
}

export interface User {
  id: string;
  groupName: string; // 団体名
  representative: string; // 代表者名
  furigana: string; // フリガナ
  addressNumber: string; // 班－戸番
  phone: string; // 電話番号
  email: string; // メールアドレス
  activityContent: string; // 活動内容
  hasMonthlyFee: boolean; // 月謝の有無
  memberType: '1' | '2' | '3'; // 構成メンバー区分 (1:役員等, 2:会員のみ, 3:会員外含む)
  isApproved: boolean; // 承認済みフラグ
}

export interface DayData {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  bookings: Booking[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface TimeSlot {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
}