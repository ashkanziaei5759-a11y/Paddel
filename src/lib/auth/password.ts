import 'server-only';
import {
  createHmac,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';
import bcrypt from 'bcryptjs';

/* promisify نمی‌تواند میان دو امضای scrypt (با و بدون options) تشخیص دهد،
   پس همان نسخه‌ی کامل را دستی می‌پیچیم. */
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, key) =>
      err ? reject(err) : resolve(key as Buffer),
    );
  });
}

/**
 * هش رمز عبور.
 *
 * چرا bcryptjs کنار گذاشته شد: آن پیاده‌سازی، جاوااسکریپتِ خالص است و روی
 * همان نخِ اصلی Node اجرا می‌شود. با هزینه‌ی ۱۲، هر هش حدود ۳۵۰ میلی‌ثانیه
 * CPU می‌گیرد و در تمام آن مدت *هیچ* درخواست دیگری پردازش نمی‌شود. اندازه‌گیری
 * شد: ده ورودِ هم‌زمان، ۳٫۲ ثانیه طول کشید و در این مدت حلقه‌ی رویداد به‌جای
 * ~۳۱۶ بار، فقط ۴ بار نوبت گرفت. یعنی کل اپ برای همه قفل می‌شد — و چون
 * مسیر ورود احراز هویت نمی‌خواهد، هرکسی می‌توانست با چند درخواست در ثانیه
 * باشگاه را از کار بیندازد.
 *
 * scrypt در Node پیاده‌سازی C++ دارد و روی استخر نخ‌های libuv اجرا می‌شود:
 * نخ اصلی آزاد می‌ماند و چند هش واقعاً موازی پیش می‌روند. امنیتش هم کم‌تر
 * از bcrypt نیست؛ در برابر سخت‌افزار ویژه (ASIC/GPU) به‌خاطر مصرف حافظه
 * مقاوم‌تر هم هست.
 */

/* N=2^14 با r=8 یعنی ۱۶ مگابایت حافظه و حدود ۶۰ میلی‌ثانیه برای هر هش.
   این نقطه با اندازه‌گیری انتخاب شد، نه با حدس: N=2^15 روی همین سرور زیر
   بار هم‌زمان بیش از دو برابر کند بود، بدون آنکه در عمل امنیت معناداری
   اضافه کند. سدهای واقعیِ این اپ در برابر حدس رمز، قفلِ حساب پس از هشت
   تلاش و محدودیت نرخ روی IP است؛ سختیِ هش فقط برای حالتی است که دیتابیس
   لو برود، و در آن حالت هم ۱۶ مگابایت حافظه به‌ازای هر حدس، کرک انبوه با
   GPU را غیراقتصادی می‌کند.

   maxmem را صریح بالا می‌بریم چون پیش‌فرض Node دقیقاً ۳۲ مگابایت است و
   روی مرز، خطای «memory limit exceeded» می‌دهد. */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32, maxmem: 96 * 1024 * 1024 };
const SCRYPT_PREFIX = 'scrypt$';

async function scryptHash(plain: string, salt: Buffer): Promise<Buffer> {
  return scrypt(plain.normalize('NFKC'), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT.maxmem,
  });
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptHash(plain, salt);
  return `${SCRYPT_PREFIX}${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

/** آیا این هش با فرمت قدیمی bcrypt ذخیره شده؟ */
export function isLegacyHash(hash: string): boolean {
  return hash.startsWith('$2');
}

/**
 * بررسی رمز.
 *
 * `needsRehash` یعنی رمز درست بود ولی با الگوریتم قدیمی ذخیره شده. مسیر ورود
 * با دیدن این پرچم، هش را بی‌سروصدا به scrypt ارتقا می‌دهد؛ پس کاربران قدیمی
 * لازم نیست رمزشان را عوض کنند و bcrypt خودبه‌خود از سیستم خارج می‌شود.
 */
export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  try {
    if (isLegacyHash(hash)) {
      const ok = await bcrypt.compare(plain, hash);
      return { ok, needsRehash: ok };
    }

    const parts = hash.split('$');
    /* scrypt $ N $ r $ p $ salt $ key  →  ۶ تکه */
    if (parts.length !== 6 || parts[0] !== 'scrypt') return { ok: false, needsRehash: false };

    const [, n, r, p, saltB64, keyB64] = parts;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(keyB64, 'base64');

    const derived = await scrypt(plain.normalize('NFKC'), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT.maxmem,
    });

    if (derived.length !== expected.length) return { ok: false, needsRehash: false };
    /* مقایسه‌ی زمان‌ثابت: مقایسه‌ی معمولی با اولین بایتِ نابرابر برمی‌گردد و
       از روی همین اختلافِ زمان می‌شود هش را حدس زد. */
    const ok = timingSafeEqual(derived, expected);
    const outdated = Number(n) < SCRYPT.N;
    return { ok, needsRehash: ok && outdated };
  } catch {
    return { ok: false, needsRehash: false };
  }
}

/* ------------------------------------------------------------------ */
/*  کد یک‌بارمصرف                                                       */
/* ------------------------------------------------------------------ */

/**
 * کد OTP فقط پنج-شش رقم است و چند دقیقه عمر دارد. هشِ کند اینجا امنیتی
 * اضافه نمی‌کند — فضای جست‌وجو آن‌قدر کوچک است که سدِ واقعی، محدودیت نرخ و
 * انقضاست، نه هزینه‌ی هش. در عوض bcrypt با هزینه‌ی ۸ روی هر تأیید حدود ۲۰
 * میلی‌ثانیه نخ اصلی را می‌گرفت.
 *
 * پس HMAC-SHA256 با یک «فلفل» سمت سرور: آنی است، و چون کلید در دیتابیس
 * نیست، لو رفتن دیتابیس به‌تنهایی کدها را آشکار نمی‌کند.
 */
function otpPepper(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET تنظیم نشده یا کوتاه‌تر از ۳۲ کاراکتر است.');
  }
  return secret;
}

export async function hashOtp(code: string): Promise<string> {
  return `hmac$${createHmac('sha256', otpPepper()).update(code).digest('base64')}`;
}

export async function verifyOtp(code: string, hash: string): Promise<boolean> {
  try {
    /* کدهای در جریانِ نسخه‌ی قبلی هنوز با bcrypt ذخیره‌اند؛ چند دقیقه بعد
       خودشان منقضی می‌شوند، ولی تا آن موقع باید کار کنند. */
    if (isLegacyHash(hash)) return await bcrypt.compare(code, hash);

    const expected = Buffer.from(hash.replace(/^hmac\$/, ''), 'base64');
    const actual = Buffer.from(
      createHmac('sha256', otpPepper()).update(code).digest('base64'),
      'base64',
    );
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export interface PasswordStrength {
  ok: boolean;
  message?: string;
}

export function checkPasswordStrength(password: string): PasswordStrength {
  if (password.length < 8) return { ok: false, message: 'رمز عبور باید حداقل ۸ کاراکتر باشد.' };
  if (password.length > 72) return { ok: false, message: 'رمز عبور نباید بیش از ۷۲ کاراکتر باشد.' };
  if (!/[a-zA-Z]/.test(password)) return { ok: false, message: 'رمز عبور باید حداقل یک حرف انگلیسی داشته باشد.' };
  if (!/\d/.test(password)) return { ok: false, message: 'رمز عبور باید حداقل یک عدد داشته باشد.' };
  const weak = ['password', '12345678', 'qwertyui', 'padel123', 'iloveyou'];
  if (weak.includes(password.toLowerCase())) return { ok: false, message: 'رمز عبور بسیار ساده است.' };
  return { ok: true };
}
