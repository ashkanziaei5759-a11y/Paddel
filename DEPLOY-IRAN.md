# راه‌اندازی روی هاست و دامنه‌ی ایرانی

این راهنما برای وقتی است که می‌خواهید اپ را روی **سرور ایرانی** بالا بیاورید —
چون درگاه پرداخت ایرانی به IP ایران نیاز دارد و از سرور خارجی کار نمی‌کند.

---

## ۱. چه چیزی بخرم؟

| مورد | پیشنهاد | هزینه‌ی تقریبی سالانه |
|---|---|---|
| دامنه‌ی `.ir` | ایرنیک (nic.ir) — مستقیم و ارزان‌ترین | زیر ۵۰ هزار تومان |
| دامنه‌ی `.com` | ایران‌سرور، پارس‌پک، هاست‌ایران | ۱ تا ۲ میلیون تومان |
| سرور مجازی (VPS) | ایران‌سرور، پارس‌پک، آروان‌کلاد، مبین‌هاست | ۳ تا ۸ میلیون تومان |

**سرور مجازی بخرید، نه هاست اشتراکی.** هاست اشتراکی cPanel فقط PHP اجرا
می‌کند؛ این اپ Node.js است و به سرور مجازی نیاز دارد.

**حداقل مشخصات:**

- ۲ گیگابایت رم (۴ گیگ راحت‌تر است — ساخت پروژه رم می‌خواهد)
- ۲ هسته پردازنده
- ۲۵ گیگابایت فضا
- اوبونتو ۲۲.۰۴ یا ۲۴.۰۴

---

## ۲. اتصال دامنه به سرور

در پنل دامنه، دو رکورد `A` بسازید و به IP سرور اشاره دهید:

```
@     A    IP-سرور-شما
www   A    IP-سرور-شما
```

انتشار DNS در ایرنیک گاهی تا چند ساعت طول می‌کشد. با این دستور بررسی کنید:

```bash
dig +short example.ir
```

---

## ۳. آماده‌سازی سرور

با SSH وارد سرور شوید و این‌ها را نصب کنید:

```bash
# به‌روزرسانی
sudo apt update && sudo apt upgrade -y

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL و nginx
sudo apt install -y postgresql postgresql-contrib nginx git

# PM2 — اپ را زنده نگه می‌دارد
sudo npm install -g pm2
```

### ساخت پایگاه داده

```bash
sudo -u postgres psql
```

داخل psql:

```sql
CREATE DATABASE persian_padel;
CREATE USER padel WITH ENCRYPTED PASSWORD 'یک-رمز-قوی-اینجا';
GRANT ALL PRIVILEGES ON DATABASE persian_padel TO padel;
\c persian_padel
GRANT ALL ON SCHEMA public TO padel;
\q
```

---

## ۴. گرفتن کد و ساخت

```bash
cd /var/www
sudo git clone https://github.com/ashkanziaei5759-a11y/Paddel.git persian-padel
sudo chown -R $USER:$USER persian-padel
cd persian-padel

npm ci
cp .env.example .env
nano .env        # مقادیر را پر کنید (بخش بعد)
```

### پر کردن `.env`

```bash
# کلید امضای نشست — حتماً تصادفی بسازید
openssl rand -base64 48
```

مقادیری که حتماً باید عوض شوند:

```
DATABASE_URL="postgresql://padel:رمز-شما@localhost:5432/persian_padel?schema=public"
DIRECT_URL="postgresql://padel:رمز-شما@localhost:5432/persian_padel?schema=public"
AUTH_SECRET="خروجی openssl بالا"
NEXT_PUBLIC_APP_URL="https://example.ir"
PAYMENT_CALLBACK_URL="https://example.ir/api/payments/callback"
CRON_SECRET="openssl rand -hex 32"
SEED_ADMIN_PASSWORD="یک رمز قوی — رمز پیش‌فرض را عوض کنید"
```

> **هشدار:** فایل `.env` را هرگز در گیت نگذارید. از قبل در `.gitignore` هست.

### ساخت و راه‌اندازی پایگاه داده

```bash
npx prisma migrate deploy
npm run db:seed          # فقط بار اول — زمین‌ها و حساب مدیر را می‌سازد
npm run build
```

اگر ساخت با خطای کمبود حافظه (`exit code 137`) متوقف شد:

```bash
NODE_OPTIONS="--max-old-space-size=3072" npm run build
```

### اجرا با PM2

```bash
mkdir -p logs
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup        # دستوری که چاپ می‌کند را اجرا کنید تا پس از ریبوت بالا بیاید
```

بررسی: `curl http://127.0.0.1:3000/api/health` باید `{"status":"ok"}` بدهد.

---

## ۵. nginx و گواهی SSL

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/persian-padel
sudo nano /etc/nginx/sites-available/persian-padel   # example.ir را عوض کنید
sudo ln -s /etc/nginx/sites-available/persian-padel /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

گواهی رایگان (Let's Encrypt):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.ir -d www.example.ir
```

> اگر Let's Encrypt از سرور ایران در دسترس نبود، گواهی از خودِ شرکت هاست
> بخرید و مسیر فایل‌ها را در `deploy/nginx.conf` جایگزین کنید.

---

## ۶. یادآوری رزرو (کران)

روی سرور خودتان با `crontab` انجام می‌شود (روی Vercel رایگان ممکن نیست —
جزئیات در `docs/REMINDERS.md`):

```bash
crontab -e
```

این خط را اضافه کنید (هر ۳۰ دقیقه):

```
*/30 * * * * curl -s -H "Authorization: Bearer همان-CRON_SECRET" https://example.ir/api/cron/reminders > /dev/null
```

---

## ۷. دیوار آتش

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

پورت ۵۴۳۲ (پایگاه داده) و ۳۰۰۰ (اپ) عمداً باز نمی‌شوند — فقط از خود سرور
در دسترس‌اند.

---

## ۸. پشتیبان‌گیری

بدون پشتیبان، یک خطای انسانی همه‌ی رزروها و کیف پول‌ها را می‌برد.

```bash
sudo mkdir -p /var/backups/padel
sudo crontab -e
```

```
0 3 * * * sudo -u postgres pg_dump persian_padel | gzip > /var/backups/padel/db-$(date +\%F).sql.gz
0 4 * * * find /var/backups/padel -name '*.sql.gz' -mtime +14 -delete
```

> عکس‌ها هم داخل همین پایگاه داده‌اند (جدول `media_assets`)، پس همین یک
> پشتیبان همه‌چیز را می‌گیرد.

---

## ۹. به‌روزرسانی نسخه‌ی بعدی

```bash
cd /var/www/persian-padel
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 restart persian-padel
```

---

## ۱۰. اتصال درگاه پرداخت

پس از گرفتن کد پذیرندگی، در `.env`:

```
PAYMENT_PROVIDER="zarinpal"        # یا zibal / nextpay
ZARINPAL_MERCHANT_ID="کد-پذیرندگی-شما"
ZARINPAL_SANDBOX="false"
PAYMENT_CALLBACK_URL="https://example.ir/api/payments/callback"
```

سپس `pm2 restart persian-padel`. نیازی به تغییر کد نیست — لایه‌ی درگاه از
ابتدا قابل‌تعویض نوشته شده است.

**آدرس بازگشت** را در پنل درگاه دقیقاً همان
`https://example.ir/api/payments/callback` ثبت کنید.

---

## عیب‌یابی سریع

| نشانه | علت محتمل |
|---|---|
| `502 Bad Gateway` | اپ بالا نیست — `pm2 logs persian-padel` |
| صفحه بالا می‌آید ولی ورود کار نمی‌کند | `AUTH_SECRET` خالی یا کوتاه‌تر از ۳۲ کاراکتر |
| `P1001` هنگام ساخت | `DATABASE_URL` غلط است یا PostgreSQL بالا نیست |
| ساخت با کد ۱۳۷ می‌ایستد | رم کم — `NODE_OPTIONS="--max-old-space-size=3072"` |
| تصویرها بالا نمی‌روند | `client_max_body_size` در nginx کمتر از ۶ مگابایت |
