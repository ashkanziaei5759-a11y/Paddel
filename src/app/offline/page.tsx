export const metadata = { title: 'آفلاین' };

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-brand-gradient-soft p-6 text-center">
      <span className="text-5xl">📡</span>
      <h1 className="text-xl font-black text-white">اتصال اینترنت برقرار نیست</h1>
      <p className="max-w-xs text-sm font-semibold leading-6 text-sky-light/70">
        برای مشاهده‌ی این بخش به اینترنت نیاز دارید. پس از برقراری اتصال دوباره تلاش کنید.
      </p>
    </div>
  );
}
