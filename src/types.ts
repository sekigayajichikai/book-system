/** 自治会館の部屋（GASの確定シート・Googleカレンダーと一致させること） */
export enum RoomType {
  KAIGISHITSU = '会議室',
  WASHITSU_TATAMI = '和室（畳側）',
  WASHITSU_ISU = '和室（椅子側）',
  TOSHOSHITSU = '図書室',
}

export enum BookingStatus {
  CONFIRMED = 'CONFIRMED',
  PENDING = 'PENDING',
  CANCELLED = 'CANCELLED',
}

export interface Booking {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  room: RoomType;
  title: string;
  status: BookingStatus;
}

export interface DayData {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  bookings: Booking[];
}

export interface TimeSlot {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
}

/** Googleカレンダーから取得したイベント（APIレスポンス用） */
export interface CalendarEvent {
  id: string;
  summary: string;
  room: RoomType | null;
  start: string; // ISO 8601
  end: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

/** 予約リクエスト（LINE通知用） */
export interface BookingRequest {
  date: string;
  startTime: string;
  endTime: string;
  room: RoomType;
  name: string;
  phone: string;
  purpose: string;
  category: string;
  equipment: string[];
  price: number;
}
