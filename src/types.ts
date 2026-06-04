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
  REJECTED = 'REJECTED',
}

export interface Booking {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  room: RoomType;
  title: string;
  status: BookingStatus;
  orgName?: string | null; // 主催団体名
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

/** 予約保存リクエスト（GAS API用） */
export interface BookingRequest {
  date: string;
  slot: string;       // 午前/午後/夜間
  room: string;       // 部屋名
  title: string;      // 団体名 or イベント名
  org?: string;       // 主催団体
  category?: string;  // 利用区分
  equipment?: string[];
  price?: number;
}

/** イベント（住民向け予定表示用） */
export interface EventSummary {
  id: string;
  date: string;           // YYYY-MM-DD
  title: string;
  originalTitle?: string;    // 元タイトル（bookings由来）
  displayTitle?: string | null; // カレンダー用表示タイトル
  eventType: 'general' | 'facility' | 'closure';
  visibility: 'public' | 'internal';
  location: string | null;
  startTime: string | null; // HH:mm
  endTime: string | null;   // HH:mm
  orgName: string | null;  // 主催団体名（DB上は calendar_events.memo）
  description: string | null;
  rooms: string[];          // facility型: 使用部屋一覧
  slots: string[];          // facility型: 使用時間帯一覧
  isMajor: boolean;         // 主な予定フラグ
}

/** 団体マスタ（1団体分） */
export interface OrgEntry {
  name: string;
  tier: string;
  presets: string[];
  equipment: string[];
}

/** 団体マスタ全体（カテゴリ→団体リスト） */
export interface OrgMaster {
  orgs: Record<string, OrgEntry[]>;
  rooms: string[];
  slots: Record<string, { start: string; end: string }>;
}
