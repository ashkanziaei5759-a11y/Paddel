import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { DEFAULT_BRANDING, getBranding } from '@/lib/branding';

export const runtime = 'nodejs';
/* آیکون از پایگاه داده می‌آید و باید بلافاصله پس از تغییر در پنل عوض شود */
export const dynamic = 'force-dynamic';

/**
 * manifest اپ — پویا ساخته می‌شود تا آیکونی که مدیر در پنل می‌گذارد بدون
 * دیپلوی دوباره روی صفحه‌ی خانه‌ی گوشی بنشیند.
 */
/**
 * ابعاد واقعی یک آیکون.
 *
 * اندازه‌ای که در manifest اعلام می‌شود باید با فایل بخواند؛ اگر نخواند،
 * کروم اندروید ممکن است آیکون را نپذیرد و پیام «نصب اپ» را نشان ندهد.
 * برای فایل‌های پیش‌فرض اندازه را می‌دانیم، برای آپلودی‌ها از خود جدول
 * media_assets می‌خوانیم.
 */
async function iconSizes(url: string, fallback: string): Promise<string> {
  const id = url.match(/^\/api\/media\/([a-z0-9]+)$/i)?.[1];
  if (!id) return fallback;
  const asset = await prisma.mediaAsset
    .findUnique({ where: { id }, select: { width: true, height: true } })
    .catch(() => null);
  return asset ? `${asset.width}x${asset.height}` : fallback;
}

export async function GET() {
  const { iconUrl, maskableIconUrl } = await getBranding();

  const [iconSize, maskableSize] = await Promise.all([
    iconSizes(iconUrl, '512x512'),
    iconSizes(maskableIconUrl, '512x512'),
  ]);

  /* فایل پیش‌فرض ۱۹۲ فقط وقتی اعلام می‌شود که آیکون سفارشی جایش را نگرفته باشد */
  const usingDefaultIcon = iconUrl === DEFAULT_BRANDING.iconUrl;

  const manifest = {
    id: '/?source=pwa',
    name: 'Persian Padel — پرشین پدل',
    short_name: 'پرشین پدل',
    description: 'رزرو زمین، کیف پول، تورنومنت و مدیریت جامعه بازیکنان پدل',
    lang: 'fa-IR',
    dir: 'rtl',
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait',
    background_color: '#00071A',
    theme_color: '#000E2A',
    categories: ['sports', 'lifestyle'],
    icons: [
      ...(usingDefaultIcon
        ? [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }]
        : []),
      { src: iconUrl, sizes: iconSize, type: 'image/png', purpose: 'any' },
      { src: maskableIconUrl, sizes: maskableSize, type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'رزرو زمین', url: '/booking', icons: [{ src: iconUrl, sizes: iconSize }] },
      { name: 'بازی‌های باز', url: '/matches', icons: [{ src: iconUrl, sizes: iconSize }] },
      { name: 'تورنومنت‌ها', url: '/tournaments', icons: [{ src: iconUrl, sizes: iconSize }] },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      /* کوتاه، تا تغییر آیکون زود دیده شود ولی هر بار هم درخواست نرود */
      'Cache-Control': 'public, max-age=60, must-revalidate',
    },
  });
}
