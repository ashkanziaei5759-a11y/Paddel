/**
 * PERSIAN PADEL — نقطه‌ی شروع برای هاست‌های cPanel
 *
 * cPanel اپ Node را با Phusion Passenger اجرا می‌کند و آدرسی که باید روی آن
 * گوش بدهیم را در متغیر PORT می‌گذارد — که اغلب یک «مسیر سوکت یونیکس» است،
 * نه یک عدد. سرورِ آماده‌ی نکست (خروجی standalone) این مقدار را با
 * parseInt می‌خواند، پس مسیر سوکت برایش NaN می‌شود و روی پورت ۳۰۰۰ گوش
 * می‌دهد؛ آن‌وقت Passenger هرگز به اپ وصل نمی‌شود. این فایل همان کار را
 * درست انجام می‌دهد: مقدار PORT را همان‌طور که هست به listen می‌دهد.
 *
 * روی هاست‌های دیگر (سرور مجازی، داکر) این فایل لازم نیست.
 */
const { createServer } = require('http');
const next = require('next');

const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));

  /* عدد باشد یا مسیر سوکت — Node خودش تشخیص می‌دهد */
  const listenOn = process.env.PORT || 3000;

  server.listen(listenOn, () => {
    console.log(`Persian Padel ready on ${listenOn}`);
  });
}).catch((error) => {
  console.error('Failed to start Persian Padel:', error);
  process.exit(1);
});
