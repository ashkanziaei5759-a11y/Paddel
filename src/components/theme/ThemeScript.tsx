/**
 * تم را پیش از نخستین رنگ‌آمیزی صفحه اعمال می‌کند.
 *
 * اگر این کار به جاوااسکریپت کلاینت سپرده شود، صفحه یک لحظه روشن رندر می‌شود و
 * بعد تیره — پرش سفیدی که روی موبایل کاملاً دیده می‌شود. پس اسکریپت به‌صورت
 * همگام و پیش از <body> اجرا می‌شود.
 */
export function ThemeScript() {
  const code = `(function(){try{
    var saved = localStorage.getItem('pp-theme');
    var dark = saved ? saved === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.setAttribute('data-theme','dark');
  }catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
