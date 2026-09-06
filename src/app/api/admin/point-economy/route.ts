import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { POINT_ECONOMY_KEY } from '@/lib/point-economy';
import { handleApiError, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  /** هر امتیاز چند تومان می‌ارزد */
  tomanPerPoint: z.coerce.number().int().min(1).max(10_000_000),
  maxConvertPerOperation: z.coerce.number().int().min(1).max(1_000_000),
});

/** نرخ تبدیل امتیاز — هم برای تبدیل به موجودی و هم پرداخت رزرو با امتیاز */
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const input = schema.parse(await req.json());

    const value = {
      rialPerPoint: input.tomanPerPoint * 10,
      maxConvertPerOperation: input.maxConvertPerOperation,
    };

    await prisma.appSetting.upsert({
      where: { key: POINT_ECONOMY_KEY },
      create: {
        key: POINT_ECONOMY_KEY,
        value,
        description: 'نرخ تبدیل امتیاز و سقف هر عملیات',
        updatedBy: admin.id,
      },
      update: { value, updatedBy: admin.id },
    });

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'ADMIN_UPDATE_POINT_ECONOMY',
        entityType: 'AppSetting',
        entityId: POINT_ECONOMY_KEY,
        after: value,
      },
    });

    return ok(value);
  } catch (error) {
    return handleApiError(error);
  }
}
