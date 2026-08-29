import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePage } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db';
import { TopBar } from '@/components/nav/TopBar';
import { LevelBadge } from '@/components/ui/LevelBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { unreadCount } from '@/lib/notifications';
import { formatDateTime, formatJalaliDate, formatRelative, formatTime, toFaDigits } from '@/lib/datetime';
import { formatNumber, formatToman } from '@/lib/utils';
import { TOURNAMENT_STATUS_LABEL } from '@/lib/constants';
import { Icon, type IconName } from '@/components/ui/Icon';
import { BannerCarousel } from '@/components/home/BannerCarousel';
import { ArticleCard } from '@/components/news/ArticleCard';
import { TopPlayersRail } from '@/components/ranking/TopPlayersRail';
import { Dot } from '@/components/ui/Dot';

export const metadata: Metadata = { title: 'خانه' };
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await requirePage();
  const now = new Date();

  const [wallet, unread, nextBooking, bookingCount, upcomingTournaments, pendingRequests, banners] =
    await Promise.all([
      prisma.wallet.findUnique({ where: { userId: user.id }, select: { balance: true } }),
      unreadCount(user.id),
      prisma.booking.findFirst({
        where: { userId: user.id, status: 'CONFIRMED', startsAt: { gte: now } },
        orderBy: { startsAt: 'asc' },
        include: { court: { select: { name: true } } },
      }),
      prisma.booking.count({ where: { userId: user.id, status: { in: ['CONFIRMED', 'COMPLETED'] } } }),
      prisma.tournament.findMany({
        where: { status: { in: ['REGISTRATION_OPEN', 'ONGOING'] } },
        orderBy: { startsAt: 'asc' },
        take: 3,
        include: { _count: { select: { teams: true } } },
      }),
      prisma.partnerRequest.count({ where: { receiverId: user.id, status: 'PENDING' } }),
      prisma.banner.findMany({
        where: {
          placement: 'HOME_TOP',
          isActive: true,
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        take: 6,
      }),
    ]);

  /* بازی‌هایی که هنوز جای خالی دارند و کاربر در آن‌ها نیست */
  const openMatches = await prisma.openMatch.findMany({
    where: {
      status: 'OPEN',
      booking: { status: 'CONFIRMED', startsAt: { gt: now } },
      players: { none: { userId: user.id } },
      OR: [{ levelPolicy: 'ANY' }, { allowedLevels: { has: user.level } }],
    },
    include: {
      booking: { include: { court: { select: { name: true } } } },
      players: { select: { id: true } },
    },
    orderBy: { booking: { startsAt: 'asc' } },
    take: 3,
  });

  const [courts, articles, topPlayers] = await Promise.all([
    prisma.court.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, description: true, imageUrl: true, basePrice: true },
      take: 8,
    }),
    prisma.article.findMany({
      where: { status: 'PUBLISHED', publishedAt: { not: null } },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      take: 4,
    }),
    prisma.profile.findMany({
      where: { user: { status: 'ACTIVE' }, points: { gt: 0 } },
      orderBy: [{ points: 'desc' }, { firstName: 'asc' }],
      take: 5,
      select: {
        userId: true, firstName: true, lastName: true,
        avatarUrl: true, level: true, points: true, gender: true,
      },
    }),
  ]);

  const balance = wallet?.balance ?? 0n;

  return (
    <>
      <TopBar user={user} unread={unread} />

      <div className="page-pad stagger space-y-5 pt-1">
        {/* ---- بنرهای باشگاه ---- */}
        {banners.length > 0 && (
          <BannerCarousel
            banners={banners.map((b) => ({
              id: b.id,
              title: b.title,
              subtitle: b.subtitle,
              imageUrl: b.imageUrl,
              linkUrl: b.linkUrl,
            }))}
          />
        )}

        {/* ---- کارت وضعیت بازیکن ---- */}
        <section className="card-night p-5">
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold tracking-widest text-sky-light/60">وضعیت شما</p>
              <div className="mt-2 flex items-center gap-2">
                <LevelBadge level={user.level} size="lg" />
                <div>
                  <p className="text-[11px] font-bold text-sky-light/60">سطح بازیکن</p>
                  <p className="text-xs font-black text-white">
                    {user.role === 'ADMIN' ? 'مدیر باشگاه' : 'بازیکن باشگاه'}
                  </p>
                </div>
              </div>
            </div>
            <div className="text-left">
              <p className="text-[11px] font-bold tracking-widest text-sky-light/60">امتیاز</p>
              <p className="num mt-1 text-3xl font-black text-accent">
                {formatNumber(user.points)}
              </p>
            </div>
          </div>

          <div className="relative mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
              <p className="text-[10px] font-bold text-sky-light/60">موجودی کیف پول</p>
              <p className="num mt-1 text-sm font-black text-white">{formatToman(balance)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
              <p className="text-[10px] font-bold text-sky-light/60">تعداد رزروها</p>
              <p className="num mt-1 text-sm font-black text-white">{formatNumber(bookingCount)}</p>
            </div>
          </div>

          <div className="relative mt-4 flex gap-2">
            <Link href="/booking" className="btn-accent btn-sm flex-1">
              رزرو زمین
            </Link>
            <Link
              href="/wallet"
              className="btn btn-sm flex-1 border border-white/20 bg-white/10 text-white hover:bg-white/15"
            >
              شارژ کیف پول
            </Link>
          </div>
        </section>

        {/* ---- درخواست پارتنر در انتظار ---- */}
        {pendingRequests > 0 && (
          <Link href="/partner-requests" className="card-interactive block bg-accent-50 p-4 ring-accent-100">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-gradient text-on-accent">
                <Icon name="partner" className="h-5 w-5" strokeWidth={2.1} />
              </span>
              <div className="flex-1">
                <p className="text-xs font-extrabold text-accent-700">
                  {toFaDigits(pendingRequests)} درخواست پارتنری در انتظار پاسخ شماست
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-accent-600">
                  برای مشاهده و پاسخ کلیک کنید
                </p>
              </div>
              <span className="text-accent-600">‹</span>
            </div>
          </Link>
        )}

        {/* ---- رزرو بعدی ---- */}
        <section>
          <div className="section-title mb-3">
            <h2>رزرو بعدی شما</h2>
            <Link href="/bookings" className="text-[11px] font-bold text-brand-400 hover:text-brand-600">
              همه رزروها
            </Link>
          </div>

          {nextBooking ? (
            <Link href={`/bookings/${nextBooking.id}`} className="card-interactive block p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-gradient text-white">
                  <span className="num text-lg font-black leading-none">
                    {formatTime(nextBooking.startsAt)}
                  </span>
                  <span className="mt-1 text-[9px] font-bold text-sky-light/70">
                    {formatJalaliDate(nextBooking.startsAt, { short: true })}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-brand-800">
                    {nextBooking.court.name}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-brand-400">
                    {formatJalaliDate(nextBooking.startsAt, { withWeekday: true })}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="badge-accent">{formatRelative(nextBooking.startsAt)}</span>
                    <span className="badge-muted num">{nextBooking.code}</span>
                  </div>
                </div>
              </div>
            </Link>
          ) : (
            <EmptyState
              icon="booking"
              title="رزرو فعالی ندارید"
              description="زمین موردنظر خود را انتخاب کنید و بازی بعدی‌تان را رزرو کنید."
              actionLabel="رزرو زمین"
              actionHref="/booking"
            />
          )}
        </section>

        {/* ---- نفرات برتر ---- */}
        {topPlayers.length > 0 && (
          <section>
            <div className="section-title mb-1">
              <h2>نفرات برتر باشگاه</h2>
              <Link href="/ranking" className="text-[11px] font-bold text-brand-400 hover:text-brand-600">
                جدول کامل
              </Link>
            </div>
            <TopPlayersRail
              players={topPlayers.map((p, i) => ({ ...p, rank: i + 1 }))}
            />
          </section>
        )}

        {/* ---- زمین‌های باشگاه ---- */}
        {courts.length > 0 && (
          <section>
            <div className="section-title mb-3">
              <h2>زمین‌های باشگاه</h2>
              <Link href="/booking" className="text-[11px] font-bold text-brand-400 hover:text-brand-600">
                رزرو
              </Link>
            </div>

            {/* نوار افقی — روی موبایل جای عمودی کمتری می‌گیرد و کشیدن انگشت طبیعی است */}
            <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
              {courts.map((court) => (
                <Link
                  key={court.id}
                  href="/booking"
                  className="group relative flex h-32 w-44 shrink-0 flex-col justify-end overflow-hidden rounded-3xl bg-night-gradient p-3.5 text-white shadow-card"
                >
                  {court.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={court.imageUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-70 transition group-hover:opacity-85"
                    />
                  )}
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-scrim/90 via-scrim/35 to-transparent" />
                  <span className="relative">
                    <span className="block truncate text-xs font-extrabold">{court.name}</span>
                    <span className="num mt-1 block text-[10.5px] font-bold text-sky-light/75">
                      از {formatToman(court.basePrice)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ---- بازی‌های باز ---- */}
        {openMatches.length > 0 && (
          <section>
            <div className="section-title mb-3">
              <h2>بازی‌های باز</h2>
              <Link href="/matches" className="text-[11px] font-bold text-brand-400 hover:text-brand-600">
                همه
              </Link>
            </div>

            <div className="space-y-3">
              {openMatches.map((m) => {
                const empty = m.capacity - m.players.length;
                return (
                  <Link key={m.id} href={`/matches/${m.id}`} className="card-interactive block p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-electric-gradient text-white">
                        <span className="num text-base font-black leading-none">
                          {formatTime(m.booking.startsAt)}
                        </span>
                        <span className="mt-1 text-[9px] font-bold text-white/70">
                          {formatJalaliDate(m.booking.startsAt, { short: true })}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold text-brand-800">
                          {m.booking.court.name}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold text-brand-400">
                          {formatJalaliDate(m.booking.startsAt, { withWeekday: true })}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="badge-accent">{toFaDigits(empty)} جای خالی</span>
                          <span className="badge-muted num">{formatToman(m.sharePerPlayer)}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ---- تورنومنت‌های پیش‌رو ---- */}
        <section>
          <div className="section-title mb-3">
            <h2>تورنومنت‌های پیش‌رو</h2>
            <Link href="/tournaments" className="text-[11px] font-bold text-brand-400 hover:text-brand-600">
              همه
            </Link>
          </div>

          {upcomingTournaments.length === 0 ? (
            <EmptyState
              icon="tournament"
              title="تورنومنت فعالی وجود ندارد"
              description="به‌زودی تورنومنت‌های جدید اعلام می‌شوند."
            />
          ) : (
            <div className="space-y-3">
              {upcomingTournaments.map((t) => (
                <Link key={t.id} href={`/tournaments/${t.id}`} className="card-interactive block p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-brand-800">{t.name}</p>
                      <p className="mt-1 text-[11px] font-semibold text-brand-400">
                        {formatDateTime(t.startsAt)}
                      </p>
                    </div>
                    <span
                      className={
                        t.status === 'REGISTRATION_OPEN' ? 'badge-accent shrink-0' : 'badge-brand shrink-0'
                      }
                    >
                      {TOURNAMENT_STATUS_LABEL[t.status]}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-[11px] font-bold text-brand-400">
                    <span className="num">
                      {toFaDigits(t._count.teams)} / {toFaDigits(t.maxTeams)} تیم
                    </span>
                    {t.entryFee > 0n && (
                      <>
                        <Dot className="text-brand-200" />
                        <span className="num">ورودی {formatToman(t.entryFee)}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-50">
                    <div
                      className="h-full rounded-full bg-accent-gradient transition-all"
                      style={{ width: `${Math.min(100, (t._count.teams / t.maxTeams) * 100)}%` }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ---- اخبار باشگاه ---- */}
        {articles.length > 0 && (
          <section>
            <div className="section-title mb-3">
              <h2>اخبار باشگاه</h2>
              <Link href="/news" className="text-[11px] font-bold text-brand-400 hover:text-brand-600">
                مشاهده همه
              </Link>
            </div>

            <div className="space-y-3">
              <ArticleCard
                featured
                article={{
                  id: articles[0].id,
                  slug: articles[0].slug,
                  title: articles[0].title,
                  excerpt: articles[0].excerpt,
                  body: articles[0].body,
                  coverUrl: articles[0].coverUrl,
                  publishedAt: (articles[0].publishedAt ?? now).toISOString(),
                  isPinned: articles[0].isPinned,
                }}
              />

              {articles.length > 1 && (
                <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                  {articles.slice(1).map((a) => (
                    <Link
                      key={a.id}
                      href={`/news/${encodeURIComponent(a.slug)}`}
                      className="card-interactive w-52 shrink-0 overflow-hidden p-0"
                    >
                      {a.coverUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.coverUrl} alt="" className="h-24 w-full object-cover" />
                      )}
                      <span className="block p-3">
                        <span className="line-clamp-2 text-[11.5px] font-extrabold leading-6 text-brand-800">
                          {a.title}
                        </span>
                        <span className="mt-1.5 block text-[10px] font-bold text-brand-300">
                          {formatJalaliDate(a.publishedAt ?? now)}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ---- دسترسی سریع ---- */}
        <section>
          <h2 className="mb-3 text-base font-extrabold text-brand-800">دسترسی سریع</h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickAction href="/matches" icon="users" title="بازی‌های باز" subtitle="هم‌بازی پیدا کنید" />
            <QuickAction href="/booking" icon="booking" title="رزرو زمین" subtitle="انتخاب تاریخ و ساعت" />
            <QuickAction href="/market" icon="ticket" title="فروشگاه" subtitle="خرید با امتیاز" />
            <QuickAction href="/wallet" icon="wallet" title="کیف پول" subtitle="شارژ و تراکنش‌ها" />
            <QuickAction href="/tournaments" icon="tournament" title="تورنومنت‌ها" subtitle="ثبت‌نام و نتایج" />
            <QuickAction href="/news" icon="notification" title="اخبار باشگاه" subtitle="گزارش و آموزش" />
            <QuickAction href="/ranking" icon="rank" title="رنکینگ" subtitle="جدول امتیازها" />
            {user.role === 'ADMIN' && (
              <QuickAction
                href="/admin"
                icon="admin"
                title="پنل مدیریت"
                subtitle="مدیریت باشگاه"
                className="col-span-2 bg-brand-gradient text-white"
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function QuickAction({
  href,
  icon,
  title,
  subtitle,
  className,
}: {
  href: string;
  icon: IconName;
  title: string;
  subtitle: string;
  className?: string;
}) {
  const isDark = className?.includes('bg-brand-gradient');
  return (
    <Link href={href} className={`card-interactive flex items-center gap-3 p-4 ${className ?? ''}`}>
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
          isDark ? 'bg-white/15 text-white' : 'bg-brand-50 text-brand-700'
        }`}
      >
        <Icon name={icon} className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className={`block truncate text-xs font-extrabold ${isDark ? 'text-white' : 'text-brand-800'}`}>
          {title}
        </span>
        <span className={`block truncate text-[10px] font-semibold ${isDark ? 'text-sky-light/70' : 'text-brand-400'}`}>
          {subtitle}
        </span>
      </span>
    </Link>
  );
}
