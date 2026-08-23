import type {
  BookingStatus,
  MatchStage,
  NotificationType,
  PartnerRequestStatus,
  PaymentStatus,
  PlayerLevel,
  PointsTxType,
  RegistrationStatus,
  TournamentStatus,
  TournamentType,
  WalletTxType,
} from '@prisma/client';

export const APP_NAME = 'Persian Padel';
export const APP_NAME_FA = 'پرشین پدل';

/** ترتیب سطوح از قوی‌ترین به ضعیف‌ترین — مبنای مقایسه در قوانین تورنومنت */
export const LEVEL_ORDER: PlayerLevel[] = [
  'A_PLUS', 'A', 'A_MINUS',
  'B_PLUS', 'B', 'B_MINUS',
  'C_PLUS', 'C', 'C_MINUS',
  'D_PLUS', 'D', 'D_MINUS',
];

export const LEVEL_LABEL: Record<PlayerLevel, string> = {
  A_PLUS: 'A+', A: 'A', A_MINUS: 'A−',
  B_PLUS: 'B+', B: 'B', B_MINUS: 'B−',
  C_PLUS: 'C+', C: 'C', C_MINUS: 'C−',
  D_PLUS: 'D+', D: 'D', D_MINUS: 'D−',
};

/** رتبه‌ی عددی سطح — کوچک‌تر یعنی قوی‌تر */
export function levelRank(level: PlayerLevel): number {
  return LEVEL_ORDER.indexOf(level);
}

export const LEVEL_TIER_COLOR: Record<string, string> = {
  A: 'from-accent-400 to-accent-600',
  B: 'from-brand-400 to-brand-600',
  C: 'from-brand-300 to-brand-500',
  D: 'from-slate-300 to-slate-500',
};

export function levelTier(level: PlayerLevel): 'A' | 'B' | 'C' | 'D' {
  return LEVEL_LABEL[level][0] as 'A' | 'B' | 'C' | 'D';
}

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: 'در انتظار',
  CONFIRMED: 'تأیید شده',
  CANCELLED: 'لغو شده',
  COMPLETED: 'برگزار شده',
  NO_SHOW: 'عدم حضور',
};

export const WALLET_TX_LABEL: Record<WalletTxType, string> = {
  TOPUP: 'شارژ کیف پول',
  BOOKING_PAYMENT: 'پرداخت رزرو',
  BOOKING_REFUND: 'بازگشت وجه رزرو',
  TOURNAMENT_FEE: 'هزینه ثبت‌نام تورنومنت',
  TOURNAMENT_REFUND: 'بازگشت هزینه تورنومنت',
  ADMIN_CREDIT: 'افزایش توسط مدیریت',
  ADMIN_DEBIT: 'کاهش توسط مدیریت',
};

export const POINTS_TX_LABEL: Record<PointsTxType, string> = {
  TOURNAMENT_AWARD: 'امتیاز تورنومنت',
  ADMIN_CREDIT: 'افزایش توسط مدیریت',
  ADMIN_DEBIT: 'کاهش توسط مدیریت',
  ADJUSTMENT: 'اصلاح امتیاز',
  STORE_PURCHASE: 'خرید از فروشگاه',
  STORE_REFUND: 'بازگشت خرید فروشگاه',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  INITIATED: 'آغاز شده',
  PENDING: 'در انتظار پرداخت',
  SUCCESS: 'موفق',
  FAILED: 'ناموفق',
  CANCELLED: 'لغو شده',
  REFUNDED: 'بازگشت داده شده',
};

export const TOURNAMENT_STATUS_LABEL: Record<TournamentStatus, string> = {
  DRAFT: 'پیش‌نویس',
  REGISTRATION_OPEN: 'ثبت‌نام باز',
  REGISTRATION_CLOSED: 'ثبت‌نام بسته',
  ONGOING: 'در حال برگزاری',
  COMPLETED: 'پایان یافته',
  CANCELLED: 'لغو شده',
};

export const TOURNAMENT_TYPE_LABEL: Record<TournamentType, string> = {
  LEAGUE: 'لیگ (دوره‌ای)',
  GROUP_KNOCKOUT: 'مرحله گروهی + حذفی',
};

export const REGISTRATION_STATUS_LABEL: Record<RegistrationStatus, string> = {
  PENDING_PARTNER: 'در انتظار تأیید پارتنر',
  PENDING_PAYMENT: 'در انتظار پرداخت',
  CONFIRMED: 'تأیید شده',
  REJECTED: 'رد شده',
  CANCELLED: 'لغو شده',
  WAITLIST: 'لیست انتظار',
};

export const PARTNER_REQUEST_STATUS_LABEL: Record<PartnerRequestStatus, string> = {
  PENDING: 'در انتظار پاسخ',
  ACCEPTED: 'پذیرفته شده',
  REJECTED: 'رد شده',
  CANCELLED: 'لغو شده',
  EXPIRED: 'منقضی شده',
};

export const MATCH_STAGE_LABEL: Record<MatchStage, string> = {
  LEAGUE: 'لیگ',
  GROUP: 'مرحله گروهی',
  ROUND_OF_32: 'یک‌شانزدهم نهایی',
  ROUND_OF_16: 'یک‌هشتم نهایی',
  QUARTER_FINAL: 'یک‌چهارم نهایی',
  SEMI_FINAL: 'نیمه‌نهایی',
  THIRD_PLACE: 'رده‌بندی',
  FINAL: 'فینال',
};

export const NOTIFICATION_ICON: Record<NotificationType, string> = {
  PARTNER_REQUEST: '🤝',
  PARTNER_ACCEPTED: '✅',
  PARTNER_REJECTED: '❌',
  BOOKING_CONFIRMED: '🎾',
  BOOKING_CANCELLED: '🚫',
  WALLET_REFUND: '💰',
  WALLET_TOPUP: '💳',
  TOURNAMENT_STARTED: '🏆',
  TOURNAMENT_REGISTERED: '📝',
  POINTS_AWARDED: '⭐',
  LEVEL_CHANGED: '📈',
  DRAFT_YOUR_TURN: '👑',
  GENERAL: '🔔',
};

/** رتبه‌ی نهایی → عنوان فارسی */
export const RANK_LABEL: Record<number, string> = {
  1: 'قهرمان',
  2: 'نایب‌قهرمان',
  3: 'مقام سوم',
  4: 'مقام چهارم',
};

export function rankLabel(rank: number): string {
  return RANK_LABEL[rank] ?? `مقام ${rank}`;
}

/** سیاست پیش‌فرض جریمه‌ی لغو — قابل بازنویسی از پایگاه داده */
export const DEFAULT_CANCELLATION_POLICIES = [
  { name: 'بیشتر از ۴ ساعت مانده', minMinutesBefore: 240, maxMinutesBefore: null, penaltyPercent: 0 },
  { name: 'بین ۲ تا ۴ ساعت مانده', minMinutesBefore: 120, maxMinutesBefore: 240, penaltyPercent: 15 },
  { name: 'بین ۱ تا ۲ ساعت مانده', minMinutesBefore: 60, maxMinutesBefore: 120, penaltyPercent: 25 },
  { name: 'بین ۳۰ دقیقه تا ۱ ساعت مانده', minMinutesBefore: 30, maxMinutesBefore: 60, penaltyPercent: 30 },
  { name: 'کمتر از ۳۰ دقیقه مانده', minMinutesBefore: 0, maxMinutesBefore: 30, penaltyPercent: 50 },
] as const;

export const SETTING_KEYS = {
  BOOKING_ENABLED: 'booking.enabled',
  TOPUP_MIN: 'wallet.topup.min',
  TOPUP_MAX: 'wallet.topup.max',
  TOPUP_PRESETS: 'wallet.topup.presets',
  CLUB_CONTACT: 'club.contact',
} as const;
