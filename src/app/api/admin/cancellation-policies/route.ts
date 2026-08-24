import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { AppError, handleApiError, ok } from '@/lib/api';
import { cancellationPolicyListSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    const policies = await prisma.cancellationPolicy.findMany({
      orderBy: { minMinutesBefore: 'desc' },
    });
    return ok({ policies });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * جایگزینی کامل پله‌های جریمه‌ی لغو.
 * چون این پله‌ها با هم یک قانون واحد می‌سازند، به‌صورت مجموعه ذخیره می‌شوند
 * تا هیچ‌گاه ترکیبی نیمه‌کاره در پایگاه داده باقی نماند.
 */
export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const { policies } = cancellationPolicyListSchema.parse(body);

    const sorted = [...policies].sort((a, b) => b.minMinutesBefore - a.minMinutesBefore);

    // پله‌ها نباید هم‌پوشانی داشته باشند و باید کل بازه را پوشش دهند
    for (let i = 0; i < sorted.length; i += 1) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (!next) {
        if (current.minMinutesBefore !== 0) {
          throw new AppError('آخرین پله باید از دقیقه‌ی صفر شروع شود تا همه‌ی حالت‌ها پوشش داده شوند.');
        }
        continue;
      }
      const upperOfNext = next.maxMinutesBefore ?? Number.POSITIVE_INFINITY;
      if (upperOfNext !== current.minMinutesBefore) {
        throw new AppError(
          `پله‌های «${current.name}» و «${next.name}» به‌هم پیوسته نیستند؛ کران بالای پله‌ی پایین‌تر باید برابر کران پایین پله‌ی بالاتر باشد.`,
        );
      }
    }

    if ((sorted[0].maxMinutesBefore ?? null) !== null) {
      throw new AppError('بالاترین پله باید بدون کران بالا باشد تا زمان‌های دورتر را هم پوشش دهد.');
    }

    await prisma.$transaction(async (tx) => {
      const before = await tx.cancellationPolicy.findMany();

      await tx.cancellationPolicy.deleteMany({});
      await tx.cancellationPolicy.createMany({
        data: sorted.map((p) => ({
          name: p.name,
          minMinutesBefore: p.minMinutesBefore,
          maxMinutesBefore: p.maxMinutesBefore ?? null,
          penaltyPercent: p.penaltyPercent,
          isActive: p.isActive,
        })),
      });

      await tx.auditLog.create({
        data: {
          userId: admin.id,
          action: 'ADMIN_UPDATE_CANCELLATION_POLICIES',
          entityType: 'CancellationPolicy',
          before: before.map((p) => ({
            name: p.name,
            min: p.minMinutesBefore,
            max: p.maxMinutesBefore,
            penalty: p.penaltyPercent,
          })),
          after: sorted.map((p) => ({
            name: p.name,
            min: p.minMinutesBefore,
            max: p.maxMinutesBefore ?? null,
            penalty: p.penaltyPercent,
          })),
        },
      });
    });

    const saved = await prisma.cancellationPolicy.findMany({
      orderBy: { minMinutesBefore: 'desc' },
    });
    return ok({ policies: saved });
  } catch (error) {
    return handleApiError(error);
  }
}
