# راه‌اندازی روی هاست cPanel ایرانی

بله، بدون سرور مجازی و فقط با cPanel هم می‌شود — **به شرطی که هاست دو چیز
داشته باشد**. پیش از خرید حتماً این‌ها را از پشتیبانی بپرسید.

---

## ۰. پیش از خرید — سه چیز را بپرسید

| چه بپرسید | چرا |
|---|---|
| **«Setup Node.js App» دارید؟ نسخه‌ی Node چند؟** | این اپ Node.js است. cPanel بدون این ابزار فقط PHP اجرا می‌کند. حداقل **Node 20** لازم است. |
| **PostgreSQL دارید یا فقط MySQL؟** | پایگاه داده‌ی اپ PostgreSQL است. اگر هاست فقط MySQL بدهد، بخش ۹ را بخوانید. |
| **دسترسی SSH یا Terminal دارید؟** | برای اجرای مهاجرت‌های پایگاه داده لازم است. اگر ندهند، راه جایگزین در بخش ۵ آمده. |

اگر پاسخ اولی «نه» بود، آن هاست به درد نمی‌خورد — دنبال پلنی بگردید که
«هاست Node.js» یا «CloudLinux» داشته باشد. ایران‌سرور، پارس‌پک و میزبان‌فا
چنین پلن‌هایی دارند.

> **نکته درباره‌ی منابع:** حداقل **۱ گیگابایت رم** برای اپ لازم است. پلن‌های
> خیلی ارزان (۲۵۶ یا ۵۱۲ مگابایت) اپ را وسط کار می‌کُشند.

---

## ۱. ساخت پروژه روی کامپیوتر خودتان

هاست اشتراکی معمولاً رم کافی برای ساخت ندارد، پس روی سیستم خودتان می‌سازیم:

```bash
git clone https://github.com/ashkanziaei5759-a11y/Paddel.git
cd Paddel
npm ci
bash deploy/build-for-cpanel.sh
```

فایل `cpanel-upload.zip` ساخته می‌شود.

> `node_modules` داخل زیپ نیست — خودِ cPanel نصبش می‌کند. `.env` هم نیست؛
> مقادیرش را در پنل وارد می‌کنید (بخش ۴).

---

## ۲. ساخت پایگاه داده در cPanel

در cPanel دنبال **PostgreSQL Databases** بگردید:

1. یک دیتابیس بسازید: مثلاً `padel`
2. یک کاربر بسازید و رمز قوی بگذارید
3. کاربر را با دسترسی **ALL PRIVILEGES** به دیتابیس اضافه کنید

cPanel معمولاً جلوی نام‌ها پیشوند حساب می‌گذارد، مثل `myuser_padel`. **همان
نام کامل** را یادداشت کنید.

---

## ۳. آپلود فایل‌ها

1. در **File Manager** پوشه‌ای بسازید، مثلاً `padelapp` (کنار `public_html`،
   نه داخلش — کد اپ نباید مستقیم از وب قابل دانلود باشد)
2. `cpanel-upload.zip` را داخلش آپلود و **Extract** کنید

---

## ۴. ساخت اپ Node در cPanel

**Setup Node.js App** → **Create Application**:

| فیلد | مقدار |
|---|---|
| Node.js version | ۲۰ یا بالاتر |
| Application mode | `Production` |
| Application root | `padelapp` |
| Application URL | دامنه‌ی شما |
| Application startup file | `app.js` |

سپس در همان صفحه، بخش **Environment variables** این‌ها را اضافه کنید:

```
CPANEL              = 1
NODE_ENV            = production
DATABASE_URL        = postgresql://کاربر:رمز@127.0.0.1:5432/نام-دیتابیس?schema=public
DIRECT_URL          = همان مقدار بالا
AUTH_SECRET         = خروجی openssl rand -base64 48
SESSION_TTL_DAYS    = 30
APP_TIMEZONE        = Asia/Tehran
NEXT_PUBLIC_APP_URL = https://example.ir
NEXT_PUBLIC_APP_NAME= Persian Padel
PAYMENT_PROVIDER    = mock
PAYMENT_CALLBACK_URL= https://example.ir/api/payments/callback
OTP_PROVIDER        = console
CRON_SECRET         = خروجی openssl rand -hex 32
SEED_ADMIN_USERNAME = admin
SEED_ADMIN_PASSWORD = یک رمز قوی
SEED_ADMIN_PHONE    = 09xxxxxxxxx
```

> **`CPANEL = 1` را حتماً بگذارید.** بدون آن، نکست فکر می‌کند در حالت
> standalone اجرا می‌شود و هشدار می‌دهد.

حالا دکمه‌ی **Run NPM Install** را بزنید. چند دقیقه طول می‌کشد.

---

## ۵. ساخت جدول‌های پایگاه داده

در همان صفحه‌ی Setup Node.js App، بالای صفحه دستوری مثل این نوشته شده:

```bash
source /home/USER/nodevenv/padelapp/20/bin/activate && cd /home/USER/padelapp
```

آن را در **Terminal** (یا SSH) اجرا کنید، بعد:

```bash
npx prisma migrate deploy
npm run db:seed        # فقط بار اول — زمین‌ها و حساب مدیر را می‌سازد
```

**اگر هاستتان Terminal ندارد:** مهاجرت‌ها را از کامپیوتر خودتان اجرا کنید،
به شرطی که هاست «Remote PostgreSQL» را برای IP شما باز کرده باشد:

```bash
DATABASE_URL="postgresql://کاربر:رمز@آدرس-هاست:5432/دیتابیس" npx prisma migrate deploy
```

---

## ۶. اجرا

در Setup Node.js App دکمه‌ی **Restart** را بزنید. دامنه را باز کنید — باید
صفحه‌ی ورود بیاید.

بررسی سلامت: `https://example.ir/api/health` باید این را بدهد:

```json
{"status":"ok","database":"connected"}
```

---

## ۷. یادآوری رزرو (Cron Jobs)

در cPanel → **Cron Jobs**، یک کار با بازه‌ی «Twice Per Hour» بسازید:

```
curl -s -H "Authorization: Bearer همان-CRON_SECRET" https://example.ir/api/cron/reminders > /dev/null
```

این همان کاری است که روی Vercel پولی لازم داشت و اینجا رایگان است.

---

## ۸. به‌روزرسانی نسخه‌ی بعدی

```bash
# روی کامپیوتر خودتان
git pull && npm ci && bash deploy/build-for-cpanel.sh
```

بعد در File Manager:

1. پوشه‌ی `.next` قدیمی را حذف کنید
2. زیپ تازه را آپلود و استخراج کنید
3. اگر مهاجرت تازه‌ای بود: `npx prisma migrate deploy`
4. **Restart** در Setup Node.js App

---

## ۹. اگر هاست فقط MySQL دارد

پایگاه داده‌ی اپ PostgreSQL است و **همین‌طور که هست روی MySQL اجرا نمی‌شود**.
دلیلش یک تفاوت واقعی است، نه سلیقه: چند جای اسکیما از «آرایه» استفاده می‌کند
(مثلاً سطح‌های مجاز یک بازی یا ترکیب‌های مجاز تورنومنت)، و MySQL در Prisma
آرایه ندارد.

سه راه دارید، به ترتیب ترجیح:

1. **پلنی با PostgreSQL بگیرید.** ساده‌ترین و بی‌دردسرترین راه.
2. **دیتابیس جدا بخرید.** بعضی شرکت‌های ایرانی «سرویس PostgreSQL» مستقل
   می‌فروشند؛ اپ روی cPanel می‌ماند و فقط `DATABASE_URL` به آن اشاره می‌کند.
3. **مهاجرت اسکیما به MySQL.** شدنی است، ولی کار کمی نیست و به منطق مالی
   (کیف پول، امانت سهم بازیکنان) دست می‌زند — جایی که یک اشتباه یعنی پول
   جابه‌جا شده. اگر این راه را خواستید، بگویید تا با تست کامل انجامش دهم.

---

## عیب‌یابی

| نشانه | علت محتمل |
|---|---|
| `503 Service Unavailable` | اپ بالا نیامده — لاگ را در Setup Node.js App ببینید |
| `Cannot find module 'next'` | «Run NPM Install» را نزده‌اید |
| صفحه می‌آید ولی بی‌استایل است | پوشه‌ی `.next` ناقص آپلود شده؛ دوباره استخراج کنید |
| `P1001: Can't reach database` | `DATABASE_URL` غلط است یا کاربر دسترسی ندارد |
| ورود کار نمی‌کند | `AUTH_SECRET` خالی یا کمتر از ۳۲ کاراکتر |
| اپ مدام ری‌استارت می‌شود | رم پلن کم است — پلن بالاتر لازم دارید |
| تصویر آپلود نمی‌شود | سقف حجم آپلود هاست را روی ۶ مگابایت یا بیشتر ببرند |
