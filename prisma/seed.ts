/**
 * اجرای داده‌ی اولیه از خط فرمان:  npm run db:seed
 * منطق واقعی در src/lib/seed.ts است تا /api/setup هم بتواند همان را اجرا کند.
 */

import { PrismaClient } from '@prisma/client';
import { runSeed } from '../src/lib/seed';

const prisma = new PrismaClient();

console.info('🎾 شروع مقداردهی اولیه پایگاه داده…\n');

// SEED_ESSENTIALS_ONLY=1 → فقط حساب مدیر و تنظیمات پایه (نصب واقعی)
const essentialsOnly = process.env.SEED_ESSENTIALS_ONLY === '1';

runSeed(prisma, (line) => console.info(line), { essentialsOnly })
  .then(() => console.info('\n🎉 مقداردهی اولیه با موفقیت انجام شد.\n'))
  .catch((error) => {
    console.error('❌ خطا در مقداردهی اولیه:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
