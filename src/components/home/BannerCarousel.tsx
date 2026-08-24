'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface BannerDto {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkUrl: string | null;
}

/**
 * بنرهای چرخشی صفحه‌ی اصلی.
 *
 * چرخش خودکار با «کاهش انیمیشن» سیستم‌عامل متوقف می‌شود و با کشیدن انگشت هم
 * می‌توان جابه‌جا شد — روی موبایل کشیدن طبیعی‌تر از زدن نقطه‌هاست.
 */
export function BannerCarousel({
  banners,
  interval = 6000,
}: {
  banners: BannerDto[];
  interval?: number;
}) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const reduceMotion = useReducedMotion();
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback(
    (next: number) => setIndex(((next % banners.length) + banners.length) % banners.length),
    [banners.length],
  );

  useEffect(() => {
    if (reduceMotion || banners.length <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % banners.length), interval);
    return () => clearInterval(timer);
  }, [banners.length, interval, reduceMotion]);

  if (banners.length === 0) return null;
  const current = banners[index];

  const inner = (
    <div
      className="relative h-[148px] w-full overflow-hidden rounded-3xl bg-brand-gradient shadow-card"
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const delta = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(delta) > 45) goTo(index + (delta > 0 ? 1 : -1));
        touchStartX.current = null;
      }}
    >
      {!failed[current.id] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={current.id}
          src={current.imageUrl}
          alt=""
          onError={() => setFailed((p) => ({ ...p, [current.id]: true }))}
          className={cn(
            'absolute inset-0 h-full w-full object-cover',
            !reduceMotion && 'animate-fade-in',
          )}
          draggable={false}
        />
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-brand-950/85 via-brand-950/45 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-court-lines opacity-40" />

      <div className="relative flex h-full flex-col justify-end p-4">
        <p className="text-sm font-black leading-6 text-white text-balance">{current.title}</p>
        {current.subtitle && (
          <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-5 text-sky-light/85">
            {current.subtitle}
          </p>
        )}
      </div>

      {banners.length > 1 && (
        <div className="absolute bottom-3 left-4 flex gap-1.5">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                goTo(i);
              }}
              aria-label={`نمایش بنر ${i + 1}`}
              aria-current={i === index}
              className={cn(
                'h-1.5 cursor-pointer rounded-full transition-all duration-300',
                i === index ? 'w-5 bg-accent' : 'w-1.5 bg-white/55',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (!current.linkUrl) return inner;

  return current.linkUrl.startsWith('/') ? (
    <Link href={current.linkUrl} aria-label={current.title}>{inner}</Link>
  ) : (
    <a href={current.linkUrl} target="_blank" rel="noopener noreferrer" aria-label={current.title}>
      {inner}
    </a>
  );
}
