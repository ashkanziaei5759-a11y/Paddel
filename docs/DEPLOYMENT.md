# راهنمای استقرار پرشین پدل

این سند مرحله‌به‌مرحله توضیح می‌دهد اپلیکیشن را کجا و چطور بالا بیاورید.

---

## ⚠️ نکته‌ی مهم درباره‌ی InfinityFree

**این پروژه روی InfinityFree اجرا نمی‌شود.**

InfinityFree یک هاست اشتراکی **PHP + MySQL** است و محیط اجرای **Node.js** ندارد.
پرشین پدل با Next.js نوشته شده و برای اجرا به یک فرایند دائمی Node و یک پایگاه
داده‌ی **PostgreSQL** نیاز دارد. آپلود فایل‌ها در `htdocs` باعث اجرای برنامه
نمی‌شود؛ مرورگر فقط کد خام را می‌بیند یا خطای ۴۰۳ می‌گیرد.

خبر خوب: **دامنه‌ی شما هدر نمی‌رود.** دو حالت دارد:

| نوع دامنه | آیا قابل استفاده است؟ | روش |
|---|---|---|
| دامنه‌ی واقعی که خودتان خریده‌اید (`example.com`) | ✅ بله | فقط رکوردهای DNS را به هاست جدید تغییر دهید (بخش ۵) |
| زیردامنه‌ی رایگان InfinityFree (`something.rf.gd` / `.free.nf` / `.wuaze.com`) | ⚠️ معمولاً نه | این زیردامنه‌ها اجازه‌ی تغییر NS/A به بیرون را نمی‌دهند. یک دامنه‌ی ارزان `.ir` یا `.com` بگیرید |

> دامنه‌ی `.ir` از [ایرنیک](https://www.nic.ir) سالانه چند ده هزار تومان است و
> برای درگاه پرداخت ایرانی هم مناسب‌تر است.

---

## ۱. انتخاب میزبان

چون اپلیکیشن به درگاه پرداخت ایرانی و پیامک ایرانی وصل می‌شود و کاربران داخل
ایران هستند، **میزبان ایرانی گزینه‌ی درست است**.

| گزینه | مناسب برای | هزینه‌ی تقریبی | سختی |
|---|---|---|---|
| **لیارا** (liara.ir) | بهترین انتخاب برای شروع | از ~۱۰۰هزار تومان/ماه | ⭐ آسان |
| **آروان‌کلاد** (arvancloud.ir) | مشابه لیارا | مشابه | ⭐⭐ متوسط |
| **هم‌روش** (hamravesh.com) | مشابه لیارا | مشابه | ⭐⭐ متوسط |
| **سرور مجازی ایرانی** + Docker | کنترل کامل، ارزان‌تر در بلندمدت | از ~۱۵۰هزار تومان/ماه | ⭐⭐⭐ نیاز به دانش لینوکس |
| Vercel + Neon | فقط اگر کاربران خارج ایران‌اند | رایگان | ⭐ آسان |

> **درباره‌ی Vercel:** سرویس رایگان و عالی است، اما از ایران بدون واسطه در دسترس
> نیست و شرایط استفاده‌اش کاربران ایران را محدود می‌کند. برای باشگاهی در ایران
> پیشنهاد نمی‌شود.

**پیشنهاد من: لیارا.** ادامه‌ی سند با همین فرض نوشته شده و روش‌های دیگر هم آمده است.

---

## ۲. استقرار روی لیارا (پیشنهادی)

### ۲.۱ ساخت پایگاه داده

1. در [console.liara.ir](https://console.liara.ir) وارد شوید.
2. از بخش **دیتابیس** → **ایجاد دیتابیس** → **PostgreSQL** را انتخاب کنید.
3. پلن را انتخاب و دیتابیس را بسازید.
4. پس از ساخت، وارد دیتابیس شوید و **رشته‌ی اتصال (Connection String)** را کپی کنید.
   چیزی شبیه این است:

```
postgresql://root:PASSWORD@postgres-xxx.liara.cloud:PORT/postgres
```

> اگر لیارا گزینه‌ی «اتصال عمومی» دارد آن را روشن کنید تا از بیرون هم بتوانید
> مهاجرت بزنید.

### ۲.۲ ساخت اپلیکیشن

1. بخش **اپلیکیشن‌ها** → **ایجاد برنامه**.
2. پلتفرم را روی **Docker** بگذارید (فایل `liara.json` و `Dockerfile` در پروژه آماده است).
3. یک نام انتخاب کنید، مثلاً `persian-padel`.

### ۲.۳ تنظیم متغیرهای محیطی

در تنظیمات اپلیکیشن → **متغیرهای محیطی**، این‌ها را اضافه کنید:

```bash
DATABASE_URL=postgresql://root:PASSWORD@postgres-xxx.liara.cloud:PORT/postgres
AUTH_SECRET=<خروجی دستور زیر>
NEXT_PUBLIC_APP_URL=https://persian-padel.liara.run
APP_TIMEZONE=Asia/Tehran

# پیامک
OTP_PROVIDER=kavenegar
KAVENEGAR_API_KEY=<کلید شما>
KAVENEGAR_TEMPLATE=<نام الگوی شما>

# درگاه پرداخت
PAYMENT_PROVIDER=zarinpal
ZARINPAL_MERCHANT_ID=<مرچنت آیدی شما>
ZARINPAL_SANDBOX=false
```

برای تولید `AUTH_SECRET` روی کامپیوتر خودتان:

```bash
openssl rand -base64 48
```

> ⚠️ `NEXT_PUBLIC_APP_URL` باید **دقیقاً** نشانی نهایی سایت باشد. اگر اشتباه باشد،
> کاربر بعد از پرداخت به جای درست برنمی‌گردد و کیف پولش شارژ نمی‌شود.

### ۲.۴ آپلود و اجرا

CLI لیارا را نصب کنید و از پوشه‌ی پروژه:

```bash
npm i -g @liara/cli
liara login
liara deploy --app persian-padel --platform docker
```

مهاجرت‌های پایگاه داده **خودکار** هنگام بالا آمدن اجرا می‌شوند (فایل
`docker/entrypoint.sh` این کار را می‌کند). نیازی به کار دستی نیست.

### ۲.۵ ساخت حساب مدیر

یک بار، از کامپیوتر خودتان با همان `DATABASE_URL` سرور:

```bash
DATABASE_URL="postgresql://root:PASSWORD@postgres-xxx.liara.cloud:PORT/postgres" \
SEED_ADMIN_USERNAME="admin" \
SEED_ADMIN_PASSWORD="یک-رمز-قوی-انتخاب-کنید" \
SEED_ADMIN_PHONE="09xxxxxxxxx" \
npm run db:seed
```

این دستور مدیر، سه زمین نمونه، پله‌های جریمه‌ی لغو و یک تورنومنت نمونه می‌سازد.

> اگر بازیکنان و تورنومنت نمونه را نمی‌خواهید، بعد از ورود از پنل مدیریت پاکشان کنید.

### ۲.۶ اتصال دامنه

در تنظیمات اپلیکیشن → **دامنه‌ها** → دامنه‌ی خود را وارد کنید. لیارا یک رکورد
DNS به شما می‌دهد؛ آن را در پنل ثبت‌کننده‌ی دامنه ثبت کنید. گواهی SSL خودکار
صادر می‌شود.

بعد از اتصال دامنه، `NEXT_PUBLIC_APP_URL` را به دامنه‌ی جدید تغییر دهید و
اپلیکیشن را دوباره راه‌اندازی کنید.

---

## ۳. استقرار روی سرور مجازی (VPS) با Docker

اگر سرور مجازی اوبونتو دارید:

```bash
# ۱. نصب داکر
curl -fsSL https://get.docker.com | sh

# ۲. گرفتن کد
git clone https://github.com/ashkanziaei5759-a11y/Paddel.git
cd Paddel

# ۳. ساخت فایل تنظیمات
cp .env.example .env
nano .env        # مقادیر را پر کنید

# ۴. اجرا — پایگاه داده و اپلیکیشن با هم بالا می‌آیند
docker compose up -d

# ۵. ساخت حساب مدیر
docker compose exec app node_modules/.bin/prisma db seed
```

اپلیکیشن روی پورت ۳۰۰۰ بالا می‌آید. برای اینکه روی دامنه با HTTPS در دسترس
باشد، یک `nginx` جلویش بگذارید:

```bash
apt install -y nginx certbot python3-certbot-nginx
```

`/etc/nginx/sites-available/padel`:

```nginx
server {
    server_name example.com;
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        'upgrade';
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass                 $http_upgrade;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/padel /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d example.com          # صدور خودکار SSL
```

### به‌روزرسانی نسخه در آینده

```bash
cd Paddel
git pull
docker compose up -d --build
```

مهاجرت‌های تازه خودکار اعمال می‌شوند.

---

## ۴. اجرا روی کامپیوتر خودتان (برای آزمایش)

```bash
cp .env.example .env
# در .env مقدار PAYMENT_PROVIDER=mock و OTP_PROVIDER=console بماند

docker compose up -d      # ساده‌ترین راه
# یا بدون داکر:
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

در این حالت:
- کد تأیید پیامک نمی‌شود؛ در **کنسول سرور** چاپ می‌شود.
- درگاه پرداخت شبیه‌سازی می‌شود و با یک کلیک «پرداخت موفق» انجام می‌گیرد.

---

## ۵. اتصال دامنه (هر میزبانی که باشد)

در پنل ثبت‌کننده‌ی دامنه (ایرنیک، نیک‌آی‌آر، Namecheap و…):

| نوع رکورد | نام | مقدار |
|---|---|---|
| `A` | `@` | آی‌پی سرور شما |
| `CNAME` | `www` | دامنه‌ی اصلی یا آدرسی که میزبان می‌دهد |

اگر میزبان (مثل لیارا) رکورد اختصاصی می‌دهد، همان را وارد کنید.

انتشار DNS بین چند دقیقه تا ۲۴ ساعت طول می‌کشد. بررسی:

```bash
nslookup example.com
```

---

## ۶. کارهای لازم پیش از راه‌اندازی واقعی

این‌ها را حتماً انجام دهید:

- [ ] `AUTH_SECRET` را با `openssl rand -base64 48` تولید کرده‌اید (مقدار پیش‌فرض را نگذارید).
- [ ] رمز حساب `admin` را از `Admin@12345` تغییر داده‌اید.
- [ ] بازیکنان نمونه‌ی seed را پاک کرده‌اید.
- [ ] `PAYMENT_PROVIDER` روی درگاه واقعی است، نه `mock`.
      (اپلیکیشن در حالت تولید اجازه‌ی `mock` را نمی‌دهد و خطا می‌دهد — این عمدی است.)
- [ ] `ZARINPAL_SANDBOX=false` است.
- [ ] `OTP_PROVIDER` روی سرویس پیامک واقعی است، نه `console`.
- [ ] `NEXT_PUBLIC_APP_URL` دقیقاً برابر دامنه‌ی نهایی با `https://` است.
- [ ] در پنل زرین‌پال، آدرس بازگشت (`callback`) را روی
      `https://دامنه‌ی-شما/api/payments/callback` تنظیم کرده‌اید.
- [ ] سایت روی HTTPS بالا می‌آید (بدون HTTPS، PWA نصب نمی‌شود).
- [ ] از `/api/health` پاسخ `{"status":"ok"}` می‌گیرید.
- [ ] پشتیبان‌گیری خودکار پایگاه داده را فعال کرده‌اید (بخش ۸).

---

## ۷. گرفتن سرویس‌های جانبی

### درگاه پرداخت — زرین‌پال

1. در [zarinpal.com](https://www.zarinpal.com) ثبت‌نام کنید.
2. یک «درگاه» بسازید و مدارک کسب‌وکار را تأیید کنید.
3. **Merchant ID** را در `ZARINPAL_MERCHANT_ID` بگذارید.
4. آدرس بازگشت را `https://دامنه/api/payments/callback` ثبت کنید.

> زیبال و نکست‌پی هم پیاده‌سازی شده‌اند؛ کافی است `PAYMENT_PROVIDER` را عوض کنید.

### پیامک — کاوه‌نگار

1. در [kavenegar.com](https://kavenegar.com) ثبت‌نام و شارژ کنید.
2. از بخش **الگوها**، یک الگوی «تأیید» بسازید، مثلاً:
   `کد ورود شما به پرشین پدل: %token`
3. نام الگو را در `KAVENEGAR_TEMPLATE` و کلید API را در `KAVENEGAR_API_KEY` بگذارید.

> `sms.ir` و `قاصدک` هم پشتیبانی می‌شوند (`OTP_PROVIDER=smsir` یا `ghasedak`).

---

## ۸. پشتیبان‌گیری

**بدون پشتیبان‌گیری راه‌اندازی نکنید.** داده‌ی مالی کاربران در این پایگاه داده است.

```bash
# پشتیبان دستی
docker compose exec -T db pg_dump -U padel persian_padel | gzip > backup-$(date +%F).sql.gz

# بازگردانی
gunzip -c backup-1405-06-01.sql.gz | docker compose exec -T db psql -U padel persian_padel
```

پشتیبان روزانه‌ی خودکار — `crontab -e`:

```cron
0 3 * * * cd /root/Paddel && docker compose exec -T db pg_dump -U padel persian_padel | gzip > /root/backups/padel-$(date +\%F).sql.gz
```

روی لیارا و آروان، پشتیبان‌گیری خودکار از پنل دیتابیس فعال می‌شود.

---

## ۹. عیب‌یابی

| نشانه | علت محتمل | راه‌حل |
|---|---|---|
| صفحه بالا می‌آید ولی بی‌استایل است | فایل‌های `static` سِرو نمی‌شوند | ایمیج را دوباره بسازید (`--build`) |
| `/api/health` خطای ۵۰۳ می‌دهد | `DATABASE_URL` غلط است یا دیتابیس در دسترس نیست | رشته‌ی اتصال و فایروال را بررسی کنید |
| بعد از پرداخت، کیف پول شارژ نمی‌شود | `NEXT_PUBLIC_APP_URL` یا callback درگاه غلط است | هر دو را با دامنه‌ی واقعی هماهنگ کنید |
| کد تأیید نمی‌آید | `OTP_PROVIDER=console` است یا اعتبار پیامک تمام شده | سرویس پیامک را تنظیم/شارژ کنید |
| «درگاه آزمایشی در محیط تولید مجاز نیست» | `PAYMENT_PROVIDER=mock` در تولید | یک درگاه واقعی تنظیم کنید |
| اپ روی گوشی نصب نمی‌شود | سایت روی HTTPS نیست | گواهی SSL بگیرید |
| خطای `AUTH_SECRET` هنگام بالا آمدن | کلید تعریف نشده یا کوتاه‌تر از ۳۲ کاراکتر است | با `openssl rand -base64 48` بسازید |

دیدن لاگ‌ها:

```bash
docker compose logs -f app     # روی سرور مجازی
liara logs --app persian-padel # روی لیارا
```
