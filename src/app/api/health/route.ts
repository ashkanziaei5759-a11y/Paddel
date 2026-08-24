import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * بررسی سلامت سرویس — برای سامانه‌های میزبانی، بالانسر و مانیتورینگ.
 * اتصال پایگاه داده هم آزموده می‌شود تا «سالم» بودن واقعی باشد.
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json(
      {
        status: 'ok',
        database: 'connected',
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('[health] database check failed:', error);
    return Response.json(
      { status: 'error', database: 'unreachable', timestamp: new Date().toISOString() },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
