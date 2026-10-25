/**
 * اجرای اپ روی چند هسته‌ی پردازنده.
 *
 * Node فقط از یک هسته استفاده می‌کند. در تست بار با ۳۰۰ کاربر هم‌زمان، فرایندِ
 * تکی روی یک هسته قفل شد (۱۱۰٪ CPU) و صفحه‌ها تا ۷ ثانیه طول کشیدند، در حالی
 * که سه هسته‌ی دیگر بیکار بودند. این فایل چند نسخه از server.js را روی همان
 * پورت بالا می‌آورد و درخواست‌ها بینشان پخش می‌شود.
 *
 * اپ هیچ وضعیتی در حافظه‌ی فرایند نگه نمی‌دارد (نشست، محدودیت نرخ و قفل‌ها همه
 * در پایگاه داده‌اند)، پس اجرای چند نسخه امن است.
 *
 * تعداد نسخه‌ها: متغیر APP_WORKERS، وگرنه بر اساس هسته‌ها و رم سرور.
 */
'use strict';

const cluster = require('node:cluster');
const os = require('node:os');
const path = require('node:path');

// ویندوز به‌طور پیش‌فرض پخش درخواست‌ها را به سیستم‌عامل می‌سپارد که نامتوازن
// است؛ نوبتی (round-robin) بار را یکنواخت پخش می‌کند.
cluster.schedulingPolicy = cluster.SCHED_RR;

function workerCount() {
  const fromEnv = Number.parseInt(process.env.APP_WORKERS || '', 10);
  if (fromEnv > 0) return fromEnv;
  const cpus = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
  // ویندوز سرور و PostgreSQL حدود ۲٫۵ گیگ می‌خواهند؛ هر نسخه زیر بار تا ~۰٫۸ گیگ
  const totalGb = os.totalmem() / 2 ** 30;
  const byMemory = Math.floor((totalGb - 2.5) / 0.8);
  return Math.max(1, Math.min(cpus, byMemory, 8));
}

if (cluster.isPrimary) {
  const count = workerCount();
  let stopping = false;
  const recentDeaths = [];

  console.log(`[cluster] ${count} worker(s) on ${os.cpus().length} CPU core(s)`);
  for (let i = 0; i < count; i += 1) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    if (stopping) return;
    console.error(`[cluster] worker ${worker.process.pid} exited (${signal || code}); restarting`);
    // جلوگیری از چرخه‌ی بی‌پایان: اگر در یک دقیقه بیش از ۱۰ بار افتاد، کل
    // فرایند را می‌بندیم تا سرویس ویندوز (NSSM) با تأخیر دوباره اجرایش کند.
    const now = Date.now();
    recentDeaths.push(now);
    while (recentDeaths.length && now - recentDeaths[0] > 60_000) recentDeaths.shift();
    if (recentDeaths.length > 10) {
      console.error('[cluster] workers keep crashing; exiting so the service manager can restart');
      process.exit(1);
    }
    setTimeout(() => cluster.fork(), 1000);
  });

  const shutdown = () => {
    stopping = true;
    for (const w of Object.values(cluster.workers)) w?.kill('SIGTERM');
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} else {
  require(path.join(__dirname, 'server.js'));
}
