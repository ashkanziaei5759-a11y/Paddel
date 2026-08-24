'use client';

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ImageSliderProps extends React.HTMLAttributes<HTMLDivElement> {
  images: string[];
  interval?: number;
  /** متن جایگزین برای هر تصویر — دسترس‌پذیری */
  alts?: string[];
  /** اگر تصویر اصلی بارگذاری نشد، این تصویر نمایش داده می‌شود */
  fallbackSrc?: string;
  /** شدت پوشش تیره روی تصویر */
  overlay?: 'strong' | 'soft' | 'none';
}

/**
 * اسلایدر تصویر با گذار نرم.
 *
 * دو نکته‌ی مهم نسبت به نسخه‌ی پایه:
 *  · جهت حرکت در حالت راست‌به‌چپ برعکس می‌شود.
 *  · اگر کاربر «کاهش انیمیشن» را در سیستم‌عاملش روشن کرده باشد،
 *    چرخش خودکار متوقف و گذارها ساده می‌شوند.
 */
const ImageSlider = React.forwardRef<HTMLDivElement, ImageSliderProps>(
  ({ images, interval = 5000, alts, fallbackSrc, overlay = 'strong', className, ...props }, ref) => {
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [failed, setFailed] = React.useState<Record<number, boolean>>({});
    const reduceMotion = useReducedMotion();

    const markFailed = React.useCallback(
      (index: number) => setFailed((prev) => (prev[index] ? prev : { ...prev, [index]: true })),
      [],
    );

    /**
     * اگر تصویر پیش از hydration شکست بخورد، رویداد onError هرگز اجرا نمی‌شود.
     * بنابراین پس از سوار شدن کامپوننت، وضعیت واقعی تصویر هم بررسی می‌شود.
     */
    const checkLoaded = React.useCallback(
      (node: HTMLImageElement | null) => {
        if (node && node.complete && node.naturalWidth === 0) markFailed(currentIndex);
      },
      [currentIndex, markFailed],
    );

    React.useEffect(() => {
      if (reduceMotion || images.length <= 1) return;
      const timer = setInterval(() => {
        setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      }, interval);
      return () => clearInterval(timer);
    }, [images.length, interval, reduceMotion]);

    const offset = reduceMotion ? 0 : 40;

    return (
      <div
        ref={ref}
        className={cn('relative h-full w-full overflow-hidden bg-brand-900', className)}
        /* تصویر پشتیبان به‌صورت پس‌زمینه — اگر تصویر اصلی نبود، همین دیده می‌شود */
        style={
          fallbackSrc
            ? {
                backgroundImage: `url(${fallbackSrc})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
        {...props}
      >
        <AnimatePresence initial={false}>
          <motion.img
            key={currentIndex}
            ref={checkLoaded}
            src={images[currentIndex]}
            onError={() => markFailed(currentIndex)}
            /* تصویر ناموجود نباید متن جایگزین را روی پس‌زمینه نشان دهد */
            alt={failed[currentIndex] ? '' : (alts?.[currentIndex] ?? `تصویر ${currentIndex + 1}`)}
            initial={{ opacity: 0, scale: 1.06, x: -offset }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, x: offset }}
            transition={{ duration: reduceMotion ? 0.2 : 0.9, ease: [0.22, 0.61, 0.36, 1] }}
            className={cn(
              'absolute inset-0 h-full w-full object-cover',
              failed[currentIndex] && 'opacity-0',
            )}
            draggable={false}
          />
        </AnimatePresence>

        {/* پوشش تیره تا متن روی تصویر خوانا بماند — برای پوسترها خاموش می‌شود */}
        {overlay !== 'none' && (
          <div
            className={cn(
              'pointer-events-none absolute inset-0',
              overlay === 'strong'
                ? 'bg-gradient-to-t from-brand-950/85 via-brand-900/35 to-brand-900/20'
                : 'bg-gradient-to-t from-brand-950/40 to-transparent',
            )}
          />
        )}

        {images.length > 1 && (
          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
            {images.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  'h-2 cursor-pointer rounded-full transition-all duration-300',
                  currentIndex === index ? 'w-7 bg-accent' : 'w-2 bg-white/50 hover:bg-white/80',
                )}
                aria-label={`نمایش تصویر ${index + 1}`}
                aria-current={currentIndex === index}
              />
            ))}
          </div>
        )}
      </div>
    );
  },
);

ImageSlider.displayName = 'ImageSlider';

export { ImageSlider };
