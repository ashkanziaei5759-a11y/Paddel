import 'server-only';
import { AppError } from '@/lib/api';
import type { PaymentGateway } from './types';
import { MockGateway } from './mock';
import { NextpayGateway } from './nextpay';
import { ZarinpalGateway } from './zarinpal';
import { ZibalGateway } from './zibal';

const registry: Record<string, () => PaymentGateway> = {
  mock: () => new MockGateway(),
  zarinpal: () => new ZarinpalGateway(),
  zibal: () => new ZibalGateway(),
  nextpay: () => new NextpayGateway(),
};

/** درگاه فعال بر اساس متغیر محیطی PAYMENT_PROVIDER */
export function getGateway(id?: string): PaymentGateway {
  const key = (id || process.env.PAYMENT_PROVIDER || 'mock').toLowerCase();

  // درگاه آزمایشی هر پرداختی را «موفق» اعلام می‌کند؛
  // فعال بودن آن در تولید یعنی شارژ رایگان کیف پول.
  if (key === 'mock' && process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_PAYMENT !== 'true') {
    console.error(
      '[payments] درگاه آزمایشی در محیط تولید مسدود شد. ' +
        'متغیر محیطی PAYMENT_PROVIDER را روی zarinpal، zibal یا nextpay تنظیم کنید.',
    );
    throw new AppError(
      'درگاه پرداخت باشگاه هنوز پیکربندی نشده است. لطفاً با مدیریت باشگاه تماس بگیرید.',
      503,
      'GATEWAY_NOT_CONFIGURED',
    );
  }

  const factory = registry[key];
  if (!factory) {
    console.error(`[payments] درگاه ناشناخته در پیکربندی: «${key}»`);
    throw new AppError(
      'درگاه پرداخت باشگاه به‌درستی پیکربندی نشده است. لطفاً با مدیریت باشگاه تماس بگیرید.',
      503,
      'GATEWAY_NOT_CONFIGURED',
    );
  }
  return factory();
}

export function availableGateways(): { id: string; title: string }[] {
  return Object.values(registry).map((f) => {
    const g = f();
    return { id: g.id, title: g.title };
  });
}

export type { PaymentGateway } from './types';
