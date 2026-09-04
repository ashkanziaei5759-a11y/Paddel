import { getBranding } from "@/lib/branding";
import { cn } from "@/lib/utils";

/**
 * لوگوی باشگاه — نشانی‌اش از تنظیمات برندینگ می‌آید، نه از یک مسیر ثابت.
 * سرور-کامپوننت است تا تصویر درست از همان اولین رندر بیاید و پرشی نداشته باشد.
 */
export async function BrandLogo({
  size = 44,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const { logoUrl } = await getBranding();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn("shrink-0 rounded-2xl object-cover", className)}
    />
  );
}
