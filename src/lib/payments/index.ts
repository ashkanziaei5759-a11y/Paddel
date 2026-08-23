import 'server-only';
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
  const factory = registry[key];
  if (!factory) throw new Error(`درگاه پرداخت «${key}» پشتیبانی نمی‌شود.`);
  return factory();
}

export function availableGateways(): { id: string; title: string }[] {
  return Object.values(registry).map((f) => {
    const g = f();
    return { id: g.id, title: g.title };
  });
}

export type { PaymentGateway } from './types';
