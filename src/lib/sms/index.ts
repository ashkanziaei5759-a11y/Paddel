import 'server-only';

/**
 * لایه‌ی ارسال پیامک — قابل تعویض.
 * افزودن سرویس‌دهنده‌ی تازه = یک تابع جدید + یک سطر در registry.
 *
 * همه‌ی سرویس‌دهنده‌های ایرانی برای کد یک‌بارمصرف از «الگو» (template)
 * استفاده می‌کنند؛ بنابراین باید ابتدا در پنل سرویس‌دهنده یک الگو بسازید و
 * شناسه‌ی آن را در متغیرهای محیطی قرار دهید.
 */

export interface SmsProvider {
  readonly id: string;
  readonly title: string;
  /** ارسال کد تأیید به شماره‌ی موبایل */
  sendOtp(phone: string, code: string): Promise<void>;
}

export class SmsError extends Error {
  constructor(
    message: string,
    readonly provider: string,
  ) {
    super(message);
    this.name = 'SmsError';
  }
}

/** حالت توسعه — کد در کنسول سرور چاپ می‌شود و پیامکی ارسال نمی‌گردد. */
const consoleProvider: SmsProvider = {
  id: 'console',
  title: 'کنسول (فقط توسعه)',
  async sendOtp(phone, code) {
    console.info(`\n[OTP] کد تأیید برای ${phone}: ${code}\n`);
  },
};

/** کاوه‌نگار — https://kavenegar.com */
const kavenegarProvider: SmsProvider = {
  id: 'kavenegar',
  title: 'کاوه‌نگار',
  async sendOtp(phone, code) {
    const apiKey = requireEnv('KAVENEGAR_API_KEY', 'kavenegar');
    const template = requireEnv('KAVENEGAR_TEMPLATE', 'kavenegar');

    const url =
      `https://api.kavenegar.com/v1/${encodeURIComponent(apiKey)}/verify/lookup.json` +
      `?receptor=${encodeURIComponent(phone)}` +
      `&token=${encodeURIComponent(code)}` +
      `&template=${encodeURIComponent(template)}`;

    const res = await fetch(url, { method: 'GET' });
    const json = (await res.json().catch(() => null)) as {
      return?: { status?: number; message?: string };
    } | null;

    if (!res.ok || json?.return?.status !== 200) {
      throw new SmsError(json?.return?.message || 'ارسال پیامک ناموفق بود.', 'kavenegar');
    }
  },
};

/** sms.ir — https://sms.ir */
const smsIrProvider: SmsProvider = {
  id: 'smsir',
  title: 'اس‌ام‌اس ایران (sms.ir)',
  async sendOtp(phone, code) {
    const apiKey = requireEnv('SMSIR_API_KEY', 'smsir');
    const templateId = Number(requireEnv('SMSIR_TEMPLATE_ID', 'smsir'));

    const res = await fetch('https://api.sms.ir/v1/send/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        mobile: phone,
        templateId,
        parameters: [{ name: 'CODE', value: code }],
      }),
    });

    const json = (await res.json().catch(() => null)) as {
      status?: number;
      message?: string;
    } | null;

    if (!res.ok || json?.status !== 1) {
      throw new SmsError(json?.message || 'ارسال پیامک ناموفق بود.', 'smsir');
    }
  },
};

/** قاصدک — https://ghasedak.me */
const ghasedakProvider: SmsProvider = {
  id: 'ghasedak',
  title: 'قاصدک',
  async sendOtp(phone, code) {
    const apiKey = requireEnv('GHASEDAK_API_KEY', 'ghasedak');
    const template = requireEnv('GHASEDAK_TEMPLATE', 'ghasedak');

    const res = await fetch('https://api.ghasedak.me/v2/verification/send/simple', {
      method: 'POST',
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ receptor: phone, type: '1', template, param1: code }),
    });

    const json = (await res.json().catch(() => null)) as {
      result?: { code?: number; message?: string };
    } | null;

    if (!res.ok || json?.result?.code !== 200) {
      throw new SmsError(json?.result?.message || 'ارسال پیامک ناموفق بود.', 'ghasedak');
    }
  },
};

function requireEnv(name: string, provider: string): string {
  const value = process.env[name];
  if (!value) {
    throw new SmsError(`متغیر محیطی ${name} برای سرویس پیامک تنظیم نشده است.`, provider);
  }
  return value;
}

const registry: Record<string, SmsProvider> = {
  console: consoleProvider,
  kavenegar: kavenegarProvider,
  smsir: smsIrProvider,
  ghasedak: ghasedakProvider,
};

export function getSmsProvider(id?: string): SmsProvider {
  const key = (id || process.env.OTP_PROVIDER || 'console').toLowerCase();
  const provider = registry[key];
  if (!provider) {
    throw new SmsError(`سرویس پیامک «${key}» پشتیبانی نمی‌شود.`, key);
  }
  return provider;
}

export function availableSmsProviders(): { id: string; title: string }[] {
  return Object.values(registry).map((p) => ({ id: p.id, title: p.title }));
}
