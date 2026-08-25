import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db';
import { runSeed } from '@/lib/seed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * راه‌اندازی یک‌باره پس از استقرار — وقتی به ترمینال سرور دسترسی ندارید
 * (مثلاً روی Vercel یا Netlify) و باید حساب مدیر و داده‌ی اولیه ساخته شود.
 *
 *   curl -X POST https://YOUR-APP/api/setup -H "x-setup-key: YOUR_KEY"
 *
 * سه قفل روی این مسیر است:
 *   ۱. تا وقتی SETUP_KEY تعریف نشده باشد، مسیر اصلاً وجود ندارد (۴۰۴).
 *   ۲. کلید باید دقیقاً برابر باشد؛ مقایسه در زمان ثابت انجام می‌شود.
 *   ۳. اگر از قبل مدیری وجود داشته باشد، اجرا نمی‌شود.
 *
 * پس از موفقیت، SETUP_KEY را از متغیرهای محیطی حذف کنید.
 */

const MIN_KEY_LENGTH = 16;

function keyMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual روی طول‌های نابرابر خطا می‌دهد؛ طول خودش راز نیست.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expected = process.env.SETUP_KEY;

  if (!expected || expected.length < MIN_KEY_LENGTH) {
    // مسیر خاموش است — هیچ نشانه‌ای از وجودش نمی‌دهیم.
    return new Response('Not Found', { status: 404 });
  }

  const provided = request.headers.get('x-setup-key') ?? '';
  if (!keyMatches(provided, expected)) {
    return Response.json(
      { ok: false, error: 'کلید راه‌اندازی نادرست است.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const adminExists = await prisma.user.count({ where: { role: 'ADMIN' } });
  if (adminExists > 0) {
    return Response.json(
      {
        ok: false,
        error: 'این نصب قبلاً راه‌اندازی شده است. برای امنیت، SETUP_KEY را حذف کنید.',
      },
      { status: 409, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const lines: string[] = [];

  try {
    const summary = await runSeed(prisma, (line) => lines.push(line));

    console.info('[setup] initial data created for admin:', summary.adminUsername);

    return Response.json(
      {
        ok: true,
        message:
          'راه‌اندازی انجام شد. حالا با نام کاربری مدیر و رمزی که در SEED_ADMIN_PASSWORD گذاشته‌اید وارد شوید، ' +
          'سپس SETUP_KEY را از متغیرهای محیطی حذف کنید.',
        adminUsername: summary.adminUsername,
        courts: summary.courts,
        samplePlayers: summary.players,
        steps: lines,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[setup] seeding failed:', error);
    return Response.json(
      {
        ok: false,
        error: 'ساخت داده‌ی اولیه ناموفق بود. لاگ سرور را ببینید و از اجرای مهاجرت‌ها مطمئن شوید.',
        steps: lines,
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
