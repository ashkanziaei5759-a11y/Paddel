import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-brand-gradient-soft p-6 text-center">
      <span className="text-5xl">🎾</span>
      <h1 className="text-2xl font-black text-white">صفحه پیدا نشد</h1>
      <p className="max-w-xs text-sm font-semibold leading-6 text-sky-light/70">
        آدرسی که وارد کرده‌اید وجود ندارد یا حذف شده است.
      </p>
      <Link href="/home" className="btn-accent btn-lg mt-2">
        بازگشت به خانه
      </Link>
    </div>
  );
}
