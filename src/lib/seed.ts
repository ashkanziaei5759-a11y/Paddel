/**
 * داده‌ی اولیه‌ی پرشین پدل:
 *   · حساب مدیر
 *   · سه زمین با قیمت‌گذاری ساعات پرتقاضا
 *   · پله‌های جریمه‌ی لغو
 *   · چند بازیکن نمونه، یک تورنومنت، بنرها و کالاهای فروشگاه
 *
 * اجرای دوباره امن است (idempotent): هر بخش پیش از ساخت، وجود خود را بررسی می‌کند.
 *
 * از دو جا صدا زده می‌شود:
 *   · prisma/seed.ts  — از خط فرمان (npm run db:seed)
 *   · /api/setup      — یک‌بار پس از استقرار، وقتی به ترمینال دسترسی نیست
 */

import { PrismaClient, type PlayerLevel } from '@prisma/client';
import bcrypt from 'bcryptjs';

/** گزارش پیشرفت — در خط فرمان روی کنسول، در API داخل پاسخ برمی‌گردد */
export type Logger = (line: string) => void;

const TOMAN = 10n; // هر تومان = ۱۰ ریال
const toman = (value: number) => BigInt(value) * TOMAN;

const DEFAULT_POLICIES = [
  { name: 'بیشتر از ۴ ساعت مانده', minMinutesBefore: 240, maxMinutesBefore: null, penaltyPercent: 0 },
  { name: 'بین ۲ تا ۴ ساعت مانده', minMinutesBefore: 120, maxMinutesBefore: 240, penaltyPercent: 15 },
  { name: 'بین ۱ تا ۲ ساعت مانده', minMinutesBefore: 60, maxMinutesBefore: 120, penaltyPercent: 25 },
  { name: 'بین ۳۰ دقیقه تا ۱ ساعت مانده', minMinutesBefore: 30, maxMinutesBefore: 60, penaltyPercent: 30 },
  { name: 'کمتر از ۳۰ دقیقه مانده', minMinutesBefore: 0, maxMinutesBefore: 30, penaltyPercent: 50 },
];

const COURTS = [
  {
    name: 'زمین ۱',
    slug: 'court-1',
    description: 'زمین اصلی — سرپوشیده با نورپردازی حرفه‌ای',
    basePrice: toman(400_000),
    peakPrice: toman(550_000),
    imageUrl: '/images/login/court-1.jpg',
  },
  {
    name: 'زمین ۲',
    slug: 'court-2',
    description: 'زمین شماره دو — مناسب مسابقات دوبل',
    basePrice: toman(380_000),
    peakPrice: toman(520_000),
    imageUrl: '/images/login/court-2.jpg',
  },
  {
    name: 'زمین ۳',
    slug: 'court-3',
    description: 'زمین شماره سه — روباز با چمن مصنوعی درجه یک',
    basePrice: toman(350_000),
    peakPrice: toman(480_000),
    imageUrl: '/images/login/court-4.jpg',
  },
];

const SAMPLE_PLAYERS: {
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  level: PlayerLevel;
  points: number;
  gender: 'MALE' | 'FEMALE';
}[] = [
  { username: 'ali', firstName: 'علی', lastName: 'محمدی', phone: '09121111111', level: 'A', points: 250, gender: 'MALE' },
  { username: 'sara', firstName: 'سارا', lastName: 'رضایی', phone: '09122222222', level: 'B_PLUS', points: 180, gender: 'FEMALE' },
  { username: 'reza', firstName: 'رضا', lastName: 'کریمی', phone: '09123333333', level: 'B', points: 120, gender: 'MALE' },
  { username: 'niloofar', firstName: 'نیلوفر', lastName: 'احمدی', phone: '09124444444', level: 'A_MINUS', points: 210, gender: 'FEMALE' },
  { username: 'mohammad', firstName: 'محمد', lastName: 'حسینی', phone: '09125555555', level: 'C_PLUS', points: 60, gender: 'MALE' },
  { username: 'mina', firstName: 'مینا', lastName: 'صادقی', phone: '09126666666', level: 'C', points: 40, gender: 'FEMALE' },
  { username: 'amir', firstName: 'امیر', lastName: 'نوری', phone: '09127777777', level: 'B_MINUS', points: 95, gender: 'MALE' },
  { username: 'zahra', firstName: 'زهرا', lastName: 'موسوی', phone: '09128888888', level: 'D_PLUS', points: 15, gender: 'FEMALE' },
];

export async function runSeed(prisma: PrismaClient, log: Logger = () => {}) {
  // ---- ۱. حساب مدیر ----
  const adminUsername = process.env.SEED_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
  const adminPhone = process.env.SEED_ADMIN_PHONE || '09120000000';

  const admin = await prisma.user.upsert({
    where: { username: adminUsername },
    update: { role: 'ADMIN' },
    create: {
      username: adminUsername,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      phone: adminPhone,
      phoneVerifiedAt: new Date(),
      role: 'ADMIN',
      profile: { create: { firstName: 'مدیر', lastName: 'باشگاه', level: 'A_PLUS' } },
      wallet: { create: { balance: toman(5_000_000) } },
    },
  });
  log(`✅ حساب مدیر آماده است — نام کاربری: ${adminUsername}`);

  // ---- ۲. پله‌های جریمه لغو ----
  const policyCount = await prisma.cancellationPolicy.count();
  if (policyCount === 0) {
    await prisma.cancellationPolicy.createMany({ data: DEFAULT_POLICIES });
    log(`✅ ${DEFAULT_POLICIES.length} پله‌ی جریمه‌ی لغو ثبت شد`);
  }

  // ---- ۳. زمین‌ها و قیمت‌گذاری ----
  for (const [index, court] of COURTS.entries()) {
    const created = await prisma.court.upsert({
      where: { slug: court.slug },
      update: {},
      create: {
        name: court.name,
        slug: court.slug,
        description: court.description,
        basePrice: court.basePrice,
        imageUrl: court.imageUrl,
        slotDurationMinutes: 90,
        openingMinute: 10 * 60,
        closingMinute: 23 * 60,
        maxConsecutiveSlots: 4,
        minLeadTimeMinutes: 30,
        advanceBookingDays: 30,
        sortOrder: index,
      },
    });

    const hasRule = await prisma.courtPricingRule.count({ where: { courtId: created.id } });
    if (hasRule === 0) {
      await prisma.courtPricingRule.create({
        data: {
          courtId: created.id,
          name: 'ساعات پرتقاضا (عصر و شب)',
          startMinute: 16 * 60,
          endMinute: 23 * 60,
          daysOfWeek: [],
          price: court.peakPrice,
          priority: 10,
        },
      });
    }
  }
  log(`✅ ${COURTS.length} زمین با قیمت‌گذاری ساعات پرتقاضا آماده شد`);

  // ---- ۴. بازیکنان نمونه ----
  const playerPassword = await bcrypt.hash('Player@12345', 12);
  const players = [];

  for (const p of SAMPLE_PLAYERS) {
    const user = await prisma.user.upsert({
      where: { username: p.username },
      update: {},
      create: {
        username: p.username,
        passwordHash: playerPassword,
        phone: p.phone,
        phoneVerifiedAt: new Date(),
        role: 'PLAYER',
        profile: {
          create: { firstName: p.firstName, lastName: p.lastName, level: p.level, gender: p.gender },
        },
        wallet: { create: { balance: toman(2_000_000) } },
      },
      include: { profile: true },
    });

    // امتیاز اولیه از طریق دفتر کل تا موجودی و تاریخچه سازگار بماند
    const existingPoints = await prisma.pointsTransaction.findUnique({
      where: { referenceKey: `seed:points:${user.id}` },
    });
    if (!existingPoints && p.points > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.pointsTransaction.create({
          data: {
            userId: user.id,
            type: 'ADMIN_CREDIT',
            amount: p.points,
            balanceBefore: 0,
            balanceAfter: p.points,
            description: 'امتیاز اولیه‌ی جامعه‌ی باشگاه',
            referenceKey: `seed:points:${user.id}`,
            performedById: admin.id,
          },
        });
        await tx.profile.update({ where: { userId: user.id }, data: { points: p.points } });
      });
    }

    players.push(user);
  }
  log(`✅ ${players.length} بازیکن نمونه ساخته شد (رمز عبور: Player@12345)`);

  // ---- ۵. تورنومنت نمونه ----
  const existingTournament = await prisma.tournament.findUnique({
    where: { slug: 'jam-tabestane-persian-padel' },
  });

  if (!existingTournament) {
    const start = new Date(Date.now() + 14 * 86_400_000);
    const end = new Date(start.getTime() + 8 * 3_600_000);
    const courts = await prisma.court.findMany({ select: { id: true } });

    const tournament = await prisma.tournament.create({
      data: {
        name: 'جام تابستانه پرشین پدل',
        slug: 'jam-tabestane-persian-padel',
        description:
          'اولین دوره‌ی جام تابستانه باشگاه پرشین پدل. مرحله‌ی گروهی و سپس حذفی، با جوایز نقدی و امتیاز باشگاهی برای تیم‌های برتر.',
        type: 'GROUP_KNOCKOUT',
        status: 'REGISTRATION_OPEN',
        startsAt: start,
        endsAt: end,
        registrationClosesAt: new Date(start.getTime() - 2 * 86_400_000),
        maxTeams: 8,
        minTeams: 4,
        entryFee: toman(500_000),
        splitFeeBetweenPartners: true,
        partnerMode: 'PLAYER_CHOICE',
        groupCount: 2,
        advancingPerGroup: 2,
        hasThirdPlaceMatch: true,
        pointsForWin: 3,
        pointsForDraw: 1,
        createdById: admin.id,
        courts: { create: courts.map((c) => ({ courtId: c.id })) },
        levelRules: {
          create: {
            type: 'RANGE',
            slot1Levels: ['A_PLUS', 'A', 'A_MINUS'],
            slot2Levels: ['B_PLUS', 'B', 'B_MINUS'],
            orderInsensitive: true,
            description: 'هر تیم باید از یک بازیکن سطح A و یک بازیکن سطح B تشکیل شود.',
          },
        },
        pointsRules: {
          create: [
            { rank: 1, pointsPerPlayer: 100, label: 'قهرمان' },
            { rank: 2, pointsPerPlayer: 50, label: 'نایب‌قهرمان' },
            { rank: 3, pointsPerPlayer: 30, label: 'مقام سوم' },
          ],
        },
      },
    });
    log(`✅ تورنومنت نمونه ساخته شد: ${tournament.name}`);
  }

  // ---- ۶. تنظیمات سراسری ----
  await prisma.appSetting.upsert({
    where: { key: 'wallet.topup.presets' },
    update: {},
    create: {
      key: 'wallet.topup.presets',
      value: [200_000, 500_000, 1_000_000, 2_000_000],
      description: 'مبالغ پیشنهادی شارژ کیف پول (تومان)',
    },
  });

  await prisma.appSetting.upsert({
    where: { key: 'club.contact' },
    update: {},
    create: {
      key: 'club.contact',
      value: { phone: '021-00000000', instagram: '@persianpadel', address: 'تهران' },
      description: 'اطلاعات تماس باشگاه',
    },
  });

  // ---- ۷. بنرهای صفحه‌ی اصلی ----
  if ((await prisma.banner.count()) === 0) {
    await prisma.banner.createMany({
      data: [
        {
          title: 'جام تابستانه پرشین پدل',
          subtitle: 'ثبت‌نام باز است — تیم خود را بسازید و برای قهرمانی بجنگید.',
          imageUrl: '/images/login/court-1.jpg',
          linkUrl: '/tournaments',
          sortOrder: 0,
        },
        {
          title: 'فروشگاه باشگاه راه‌اندازی شد',
          subtitle: 'راکت، توپ و لوازم ورزشی را با امتیاز یا از کیف پول بخرید.',
          imageUrl: '/images/login/court-3.jpg',
          linkUrl: '/market',
          sortOrder: 1,
        },
        {
          title: 'ساعات پرتقاضا رزرو کنید',
          subtitle: 'زمین‌های عصر زودتر تکمیل می‌شوند — همین حالا رزرو کنید.',
          imageUrl: '/images/login/court-2.jpg',
          linkUrl: '/booking',
          sortOrder: 2,
        },
      ],
    });
    log('✅ ۳ بنر نمونه ساخته شد');
  }

  // ---- ۸. کالاهای فروشگاه ----
  const PRODUCTS = [
    { name: 'راکت پدل حرفه‌ای', slug: 'pro-racket', category: 'RACKET' as const,
      description: 'راکت کربنی مخصوص بازیکنان سطح A و B با تعادل میانی.',
      pricePoints: 1200, priceToman: 4_800_000, stock: 6 },
    { name: 'راکت پدل مبتدی', slug: 'starter-racket', category: 'RACKET' as const,
      description: 'سبک و کنترل‌پذیر، مناسب شروع بازی.',
      pricePoints: 600, priceToman: 2_200_000, stock: 10 },
    { name: 'بسته ۳ عددی توپ پدل', slug: 'ball-pack-3', category: 'BALL' as const,
      description: 'توپ استاندارد مسابقات، بسته‌ی سه‌تایی.',
      pricePoints: 90, priceToman: 380_000, stock: 40 },
    { name: 'تیشرت باشگاه', slug: 'club-tshirt', category: 'APPAREL' as const,
      description: 'تیشرت رسمی پرشین پدل با پارچه‌ی خنک.',
      pricePoints: 250, priceToman: 890_000, stock: 18 },
    { name: 'مچ‌بند ورزشی', slug: 'wristband', category: 'ACCESSORY' as const,
      description: 'جفت مچ‌بند جذب عرق.', pricePoints: 60, priceToman: 190_000, stock: 30 },
    { name: 'یک جلسه تمرین خصوصی', slug: 'private-session', category: 'SERVICE' as const,
      description: 'یک جلسه تمرین ۶۰ دقیقه‌ای با مربی باشگاه.',
      pricePoints: 800, priceToman: null, stock: 8 },
  ];

  for (const [index, p] of PRODUCTS.entries()) {
    await prisma.storeProduct.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        category: p.category,
        pricePoints: p.pricePoints,
        priceRial: p.priceToman ? toman(p.priceToman) : null,
        stock: p.stock,
        isActive: true,
        sortOrder: index,
      },
    });
  }
  log(`✅ ${PRODUCTS.length} کالای فروشگاه آماده شد`);

  // ---- ۹. اخبار نمونه ----
  const ARTICLES = [
    {
      slug: 'گزارش-فینال-جام-تابستانه',
      title: 'گزارش فینال جام تابستانه: قهرمانی در تای‌بریک ست سوم',
      excerpt:
        'فینال جام تابستانه با یک تای‌بریک نفس‌گیر در ست سوم تمام شد. مرور کامل مسابقه و صحبت‌های تیم قهرمان.',
      body: `فینال جام تابستانه پرشین پدل عصر پنج‌شنبه روی زمین شماره یک برگزار شد و تا آخرین توپ، برنده‌اش معلوم نبود.

ست اول را محمدی و رضایی با اختلاف ۶ بر ۴ بردند. فشار سرویس‌های اول و پوشش خوب دیوار پشتی، کار را برای حریف سخت کرده بود.

در ست دوم ورق برگشت. احمدی و کریمی با تغییر آرایش و بازی نزدیک‌تر به تور، ست را ۶ بر ۳ گرفتند و مسابقه به ست سوم کشید.

ست سوم تا ۶–۶ پیش رفت و در تای‌بریک، دو امتیاز پیاپی روی اسمش، کار را تمام کرد. جام به تیم محمدی / رضایی رسید و ۱۰۰ امتیاز باشگاهی به هر بازیکن تعلق گرفت.`,
      coverUrl: '/images/login/court-1.jpg',
      isPinned: true,
    },
    {
      slug: 'چگونه-دیوار-را-درست-بازی-کنیم',
      title: 'آموزش: چگونه دیوار پشتی را درست بازی کنیم',
      excerpt: 'رایج‌ترین اشتباه بازیکنان تازه‌کار پدل، عجله در ضربه‌ی برگشتی از دیوار است.',
      body: `دیوار، چیزی است که پدل را از تنیس جدا می‌کند — و همان چیزی است که بیشتر بازیکنان تازه‌کار از آن می‌ترسند.

**یک قدم عقب‌تر بایستید.** بیشتر خطاها از این می‌آید که خیلی نزدیک به دیوار می‌ایستیم و توپ در بدنمان گیر می‌کند. فاصله بگیرید و بگذارید توپ بیاید.

**صبر کنید تا توپ برگردد.** توپ پس از برخورد با دیوار سرعتش کم می‌شود؛ اگر زودتر ضربه بزنید، کنترل را از دست می‌دهید.

**راکت را پایین نگه دارید.** ضربه‌ی برگشتی از دیوار معمولاً پایین‌تر از کمر است. راکت آماده و پایین، نیمی از کار را انجام می‌دهد.

تمرین پیشنهادی: ده دقیقه فقط توپ را به دیوار بزنید و برگردانید، بدون اینکه امتیازی در کار باشد.`,
      coverUrl: '/images/login/court-2.jpg',
      isPinned: false,
    },
    {
      slug: 'افتتاح-زمین-شماره-سه',
      title: 'زمین شماره ۳ افتتاح شد',
      excerpt: 'زمین روباز با نورپردازی LED و چمن مصنوعی درجه‌یک، از این هفته قابل رزرو است.',
      body: `زمین شماره ۳ باشگاه از این هفته آماده‌ی رزرو است.

این زمین روباز است، با نورپردازی LED که بازی شبانه را هم راحت می‌کند، و چمن مصنوعی درجه‌یک که سرعت توپ را کمی بالاتر می‌برد.

تا پایان ماه، رزرو این زمین با ۲۰٪ تخفیف انجام می‌شود.`,
      coverUrl: '/images/login/court-4.jpg',
      isPinned: false,
    },
  ];

  for (const [index, a] of ARTICLES.entries()) {
    await prisma.article.upsert({
      where: { slug: a.slug },
      update: {},
      create: {
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        body: a.body,
        coverUrl: a.coverUrl,
        status: 'PUBLISHED',
        isPinned: a.isPinned,
        publishedAt: new Date(Date.now() - (index + 1) * 3 * 86_400_000),
        authorId: admin.id,
      },
    });
  }
  log(`✅ ${ARTICLES.length} مطلب نمونه منتشر شد`);

  return { adminUsername, players: players.length, courts: COURTS.length };
}
