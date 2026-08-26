import { z } from 'zod';
import { normalizePhone } from './utils';
import { toEnDigits } from './datetime';

const LEVELS = [
  'A_PLUS','A','A_MINUS','B_PLUS','B','B_MINUS',
  'C_PLUS','C','C_MINUS','D_PLUS','D','D_MINUS',
] as const;

export const zPhone = z
  .string({ required_error: 'شماره موبایل الزامی است.' })
  .transform((v) => normalizePhone(v))
  .refine((v): v is string => v !== null, { message: 'شماره موبایل معتبر نیست. مثال: ۰۹۱۲۱۲۳۴۵۶۷' });

export const zUsername = z
  .string({ required_error: 'نام کاربری الزامی است.' })
  .trim()
  .min(3, 'نام کاربری باید حداقل ۳ کاراکتر باشد.')
  .max(24, 'نام کاربری نباید بیش از ۲۴ کاراکتر باشد.')
  .regex(/^[a-zA-Z0-9_.]+$/, 'نام کاربری فقط می‌تواند شامل حروف انگلیسی، عدد، نقطه و زیرخط باشد.')
  .transform((v) => v.toLowerCase());

export const zPassword = z
  .string({ required_error: 'رمز عبور الزامی است.' })
  .min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد.')
  .max(72, 'رمز عبور نباید بیش از ۷۲ کاراکتر باشد.')
  .regex(/[a-zA-Z]/, 'رمز عبور باید حداقل یک حرف انگلیسی داشته باشد.')
  .regex(/\d/, 'رمز عبور باید حداقل یک عدد داشته باشد.');

export const zPersianName = z
  .string()
  .trim()
  .min(2, 'حداقل ۲ کاراکتر وارد کنید.')
  .max(40, 'حداکثر ۴۰ کاراکتر مجاز است.');

export const zOtpCode = z
  .string({ required_error: 'کد تأیید الزامی است.' })
  .transform((v) => toEnDigits(v).replace(/\D/g, ''))
  .refine((v) => v.length >= 4 && v.length <= 8, { message: 'کد تأیید معتبر نیست.' });

export const zLevel = z.enum(LEVELS, { errorMap: () => ({ message: 'سطح انتخابی معتبر نیست.' }) });

/** مبلغ به تومان از سمت کاربر دریافت و به ریال تبدیل می‌شود */
export const zTomanAmount = z
  .union([z.number(), z.string()])
  .transform((v) => Number(toEnDigits(String(v)).replace(/[^\d]/g, '')))
  .refine((v) => Number.isFinite(v) && v > 0, { message: 'مبلغ وارد شده معتبر نیست.' });

// --- Auth ------------------------------------------------------------------

export const signupStartSchema = z.object({
  username: zUsername,
  password: zPassword,
  firstName: zPersianName,
  lastName: zPersianName,
  phone: zPhone,
});

export const signupVerifySchema = z.object({
  verificationId: z.string().min(1, 'شناسه‌ی تأیید نامعتبر است.'),
  code: zOtpCode,
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'نام کاربری را وارد کنید.').transform((v) => v.toLowerCase()),
  password: z.string().min(1, 'رمز عبور را وارد کنید.'),
});

export const resendOtpSchema = z.object({
  verificationId: z.string().min(1),
});

export const changePhoneStartSchema = z.object({ phone: zPhone });

// --- Profile ---------------------------------------------------------------

export const updateProfileSchema = z.object({
  firstName: zPersianName.optional(),
  lastName: zPersianName.optional(),
  bio: z.string().trim().max(240, 'حداکثر ۲۴۰ کاراکتر مجاز است.').optional().nullable(),
  avatarUrl: z.string().trim().max(500).optional().nullable(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'رمز عبور فعلی را وارد کنید.'),
  newPassword: zPassword,
});

// --- Booking ---------------------------------------------------------------

export const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاریخ نامعتبر است.'),
  courtId: z.string().optional(),
});

export const createBookingSchema = z.object({
  courtId: z.string().min(1, 'زمین را انتخاب کنید.'),
  slots: z
    .array(z.string().datetime({ offset: true }))
    .min(1, 'حداقل یک سانس انتخاب کنید.')
    .max(12, 'تعداد سانس‌های انتخابی بیش از حد مجاز است.'),
  notes: z.string().trim().max(240).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().trim().max(240).optional(),
});

// --- Wallet / Payments -----------------------------------------------------

export const topupSchema = z.object({
  amountToman: zTomanAmount,
  provider: z.string().trim().optional(),
});

export const adminWalletAdjustSchema = z.object({
  userId: z.string().min(1),
  amountToman: zTomanAmount,
  direction: z.enum(['CREDIT', 'DEBIT']),
  description: z.string().trim().max(240).optional(),
});

export const adminPointsAdjustSchema = z.object({
  userId: z.string().min(1),
  amount: z.coerce.number().int().refine((v) => v !== 0, 'مقدار امتیاز نمی‌تواند صفر باشد.'),
  description: z.string().trim().max(240).optional(),
});

// --- Admin: courts ---------------------------------------------------------

export const courtSchema = z.object({
  name: z.string().trim().min(1, 'نام زمین الزامی است.').max(60),
  description: z.string().trim().max(300).optional().nullable(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  basePriceToman: zTomanAmount,
  slotDurationMinutes: z.coerce.number().int().min(15).max(240),
  openingMinute: z.coerce.number().int().min(0).max(1440),
  closingMinute: z.coerce.number().int().min(0).max(1440),
  maxConsecutiveSlots: z.coerce.number().int().min(1).max(12),
  minLeadTimeMinutes: z.coerce.number().int().min(0).max(1440),
  advanceBookingDays: z.coerce.number().int().min(1).max(180),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
}).refine((v) => v.closingMinute > v.openingMinute, {
  message: 'ساعت پایان باید بعد از ساعت شروع باشد.',
  path: ['closingMinute'],
});

export const pricingRuleSchema = z.object({
  name: z.string().trim().min(1, 'عنوان قانون الزامی است.').max(60),
  startMinute: z.coerce.number().int().min(0).max(1440),
  endMinute: z.coerce.number().int().min(0).max(1440),
  daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).max(7).default([]),
  priceToman: zTomanAmount,
  priority: z.coerce.number().int().min(0).max(100).default(0),
  isActive: z.boolean().default(true),
}).refine((v) => v.endMinute > v.startMinute, {
  message: 'پایان بازه باید بعد از شروع آن باشد.',
  path: ['endMinute'],
});

// --- Admin: users ----------------------------------------------------------

export const adminUpdateUserSchema = z.object({
  firstName: zPersianName.optional(),
  lastName: zPersianName.optional(),
  level: zLevel.optional(),
  role: z.enum(['PLAYER', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  phone: zPhone.optional(),
  resetPassword: zPassword.optional(),
});

// --- Tournaments -----------------------------------------------------------

export const tournamentSchema = z.object({
  name: z.string().trim().min(1, 'نام تورنومنت الزامی است.').max(80),
  description: z.string().trim().max(1500).optional().nullable(),
  coverUrl: z.string().trim().max(500).optional().nullable(),
  type: z.enum(['LEAGUE', 'GROUP_KNOCKOUT']),
  status: z.enum(['DRAFT','REGISTRATION_OPEN','REGISTRATION_CLOSED','ONGOING','COMPLETED','CANCELLED']).optional(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  registrationOpensAt: z.string().datetime({ offset: true }).optional().nullable(),
  registrationClosesAt: z.string().datetime({ offset: true }).optional().nullable(),
  maxTeams: z.coerce.number().int().min(2).max(128),
  minTeams: z.coerce.number().int().min(2).max(128).default(4),
  entryFeeToman: z.union([z.number(), z.string()]).transform((v) =>
    Number(toEnDigits(String(v)).replace(/[^\d]/g, '')) || 0,
  ),
  splitFeeBetweenPartners: z.boolean().default(false),
  partnerMode: z.enum(['PLAYER_CHOICE', 'LEADER_DRAFT', 'ADMIN_ASSIGN']),
  courtIds: z.array(z.string()).default([]),
  groupCount: z.coerce.number().int().min(1).max(16).optional().nullable(),
  advancingPerGroup: z.coerce.number().int().min(1).max(8).optional().nullable(),
  hasThirdPlaceMatch: z.boolean().default(false),
  doubleRoundRobin: z.boolean().default(false),
  pointsForWin: z.coerce.number().int().min(0).max(10).default(3),
  pointsForDraw: z.coerce.number().int().min(0).max(10).default(1),
  pointsForLoss: z.coerce.number().int().min(0).max(10).default(0),
  levelRule: z.object({
    type: z.enum(['FREE', 'EXACT', 'RANGE', 'COMBINATION']),
    slot1Levels: z.array(zLevel).default([]),
    slot2Levels: z.array(zLevel).default([]),
    combinations: z.array(z.object({ slot1: zLevel, slot2: zLevel })).default([]),
    orderInsensitive: z.boolean().default(true),
    description: z.string().trim().max(300).optional().nullable(),
  }).optional(),
  pointsRules: z
    .array(z.object({
      rank: z.coerce.number().int().min(1).max(64),
      pointsPerPlayer: z.coerce.number().int().min(0).max(100000),
      label: z.string().trim().max(40).optional().nullable(),
    }))
    .default([]),
}).refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
  message: 'زمان پایان باید بعد از زمان شروع باشد.',
  path: ['endsAt'],
});

export const partnerRequestSchema = z.object({
  tournamentId: z.string().min(1),
  receiverUsername: z.string().trim().min(1, 'نام کاربری پارتنر را وارد کنید.'),
  message: z.string().trim().max(240).optional(),
});

export const partnerRespondSchema = z.object({
  action: z.enum(['ACCEPT', 'REJECT']),
});

export const matchResultSchema = z.object({
  sets: z
    .array(z.object({ a: z.coerce.number().int().min(0).max(99), b: z.coerce.number().int().min(0).max(99) }))
    .min(1, 'حداقل نتیجه‌ی یک ست را وارد کنید.')
    .max(7),
  winnerTeamId: z.string().optional().nullable(),
  status: z.enum(['COMPLETED', 'WALKOVER', 'CANCELLED']).default('COMPLETED'),
  notes: z.string().trim().max(240).optional(),
});

export const draftSetupSchema = z.object({
  pickOrder: z.array(z.string()).min(2, 'حداقل دو لیدر لازم است.'),
  snakeOrder: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const draftPickSchema = z.object({
  teamId: z.string().min(1),
  playerId: z.string().min(1),
});

// --- Admin: cancellation policies ------------------------------------------

export const cancellationPolicySchema = z
  .object({
    name: z.string().trim().min(1, 'عنوان پله الزامی است.').max(60),
    minMinutesBefore: z.coerce.number().int().min(0).max(100000),
    maxMinutesBefore: z.coerce.number().int().min(0).max(100000).nullable().optional(),
    penaltyPercent: z.coerce.number().int().min(0).max(100),
    isActive: z.boolean().default(true),
  })
  .refine((v) => v.maxMinutesBefore == null || v.maxMinutesBefore > v.minMinutesBefore, {
    message: 'کران بالا باید بزرگ‌تر از کران پایین باشد.',
    path: ['maxMinutesBefore'],
  });

export const cancellationPolicyListSchema = z.object({
  policies: z.array(cancellationPolicySchema).min(1, 'حداقل یک پله لازم است.').max(12),
});

// --- Store -----------------------------------------------------------------

export const storePurchaseSchema = z.object({
  productId: z.string().min(1, 'کالا مشخص نشده است.'),
  quantity: z.coerce.number().int().min(1, 'تعداد باید حداقل ۱ باشد.').max(10, 'حداکثر ۱۰ عدد.'),
  method: z.enum(['POINTS', 'WALLET'], {
    errorMap: () => ({ message: 'روش پرداخت معتبر نیست.' }),
  }),
});

export const storeProductSchema = z
  .object({
    name: z.string().trim().min(1, 'نام کالا الزامی است.').max(80),
    description: z.string().trim().max(400).optional().nullable(),
    imageUrl: z.string().trim().max(500).optional().nullable(),
    category: z.enum(['RACKET', 'BALL', 'APPAREL', 'ACCESSORY', 'SERVICE']),
    pricePoints: z.coerce.number().int().min(0).max(1000000).optional().nullable(),
    priceToman: z.coerce.number().int().min(0).max(1000000000).optional().nullable(),
    stock: z.coerce.number().int().min(0).max(100000),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  })
  .refine((v) => (v.pricePoints ?? 0) > 0 || (v.priceToman ?? 0) > 0, {
    message: 'حداقل یکی از قیمت امتیازی یا ریالی باید تعیین شود.',
    path: ['pricePoints'],
  });

// --- Banners ---------------------------------------------------------------

export const bannerSchema = z.object({
  title: z.string().trim().min(1, 'عنوان بنر الزامی است.').max(80),
  subtitle: z.string().trim().max(160).optional().nullable(),
  imageUrl: z.string().trim().min(1, 'نشانی تصویر الزامی است.').max(500),
  linkUrl: z.string().trim().max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
  startsAt: z.string().datetime({ offset: true }).optional().nullable(),
  endsAt: z.string().datetime({ offset: true }).optional().nullable(),
});

// --- بازی باز ---------------------------------------------------------------

export const openMatchCreateSchema = z
  .object({
    bookingId: z.string().min(1, 'رزرو مشخص نشده است.'),
    capacity: z.coerce
      .number()
      .int()
      .min(2, 'ظرفیت باید حداقل ۲ نفر باشد.')
      .max(8, 'ظرفیت حداکثر ۸ نفر است.')
      .default(4),
    levelPolicy: z.enum(['ANY', 'RANGE']).default('ANY'),
    allowedLevels: z.array(zLevel).default([]),
    notes: z.string().trim().max(200, 'توضیح حداکثر ۲۰۰ کاراکتر است.').optional(),
  })
  .refine((v) => v.levelPolicy === 'ANY' || v.allowedLevels.length > 0, {
    message: 'حداقل یک سطح مجاز انتخاب کنید.',
    path: ['allowedLevels'],
  });
