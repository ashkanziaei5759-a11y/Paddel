import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/rbac';
import { handleApiError, ok } from '@/lib/api';
import { bankAccountSchema } from '@/lib/validation';
import { detectBank, maskCardNumber, maskIban } from '@/lib/bank';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * حساب بانکی خودِ بازیکن.
 *
 * حتی به صاحب حساب هم شماره‌ی کامل برگردانده نمی‌شود: پوشیده کافی است تا
 * بفهمد کدام کارت را ثبت کرده، و اگر صفحه‌ای جایی لو رفت یا اسکرین‌شاتی
 * گرفته شد، رقم کامل بیرون نرفته باشد. برای واریز، مدیر شماره‌ی کامل را
 * از مسیر ادمین می‌گیرد.
 */
export async function GET() {
  try {
    const user = await requireUser();
    const acc = await prisma.bankAccount.findUnique({ where: { userId: user.id } });

    if (!acc) return ok({ account: null });

    return ok({
      account: {
        holderName: acc.holderName,
        cardMasked: acc.cardNumber ? maskCardNumber(acc.cardNumber) : null,
        ibanMasked: acc.iban ? maskIban(acc.iban) : null,
        bankName: acc.bankName,
        verified: acc.verifiedAt !== null,
        updatedAt: acc.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = bankAccountSchema.parse(await req.json());

    const cardNumber = input.cardNumber ? input.cardNumber : null;
    const iban = input.iban ? input.iban : null;
    const bankName = cardNumber ? detectBank(cardNumber) : null;

    /* هر ویرایش، تأیید قبلی مدیر را باطل می‌کند — وگرنه بازیکن می‌توانست
       حسابِ تأییدشده را بعداً به شماره‌ی دیگری عوض کند. */
    const data = {
      holderName: input.holderName,
      cardNumber,
      iban,
      bankName,
      verifiedAt: null,
      verifiedBy: null,
    };

    const acc = await prisma.bankAccount.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    });

    return ok({
      account: {
        holderName: acc.holderName,
        cardMasked: acc.cardNumber ? maskCardNumber(acc.cardNumber) : null,
        ibanMasked: acc.iban ? maskIban(acc.iban) : null,
        bankName: acc.bankName,
        verified: false,
        updatedAt: acc.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
