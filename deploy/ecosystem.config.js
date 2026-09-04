/**
 * PERSIAN PADEL — پیکربندی PM2
 *
 * بیشتر هاست‌های ایرانی (سرور مجازی لینوکس) Docker ندارند و اپ Node را با
 * PM2 بالا نگه می‌دارند. این فایل همان کار را می‌کند: اجرای خروجی standalone
 * نکست، راه‌اندازی دوباره پس از کرش، و بالا آمدن خودکار پس از ریبوت سرور.
 *
 *   pm2 start deploy/ecosystem.config.js
 *   pm2 save && pm2 startup
 *
 * متغیرهای محیطی از فایل .env خوانده می‌شوند (با dotenv در خود اپ)، پس
 * اینجا فقط چیزهایی می‌آید که به خودِ فرایند مربوط است.
 */
module.exports = {
  apps: [
    {
      name: 'persian-padel',
      script: '.next/standalone/server.js',
      cwd: __dirname + '/..',

      /* یک نمونه به ازای هر هسته. اگر رم سرور کم است (زیر ۲ گیگ)، عدد را
         روی ۱ بگذارید؛ هر نمونه حدود ۲۰۰ مگابایت می‌گیرد. */
      instances: 1,
      exec_mode: 'fork',

      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        /* فقط روی لوکال گوش می‌دهد؛ nginx از بیرون به آن وصل می‌شود.
           این‌طور کسی نمی‌تواند پورت ۳۰۰۰ را مستقیم از اینترنت بزند. */
        HOSTNAME: '127.0.0.1',
      },

      /* اگر نشت حافظه‌ای پیش آمد، پیش از پر شدن رم سرور ری‌استارت شود */
      max_memory_restart: '600M',

      /* جلوگیری از حلقه‌ی ری‌استارت وقتی مشکل پایدار است (مثلاً DB خاموش) */
      min_uptime: '20s',
      max_restarts: 10,
      restart_delay: 3000,

      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
