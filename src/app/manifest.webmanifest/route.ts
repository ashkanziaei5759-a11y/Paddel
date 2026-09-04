import { NextResponse } from 'next/server';
import { getBranding } from '@/lib/branding';

export const runtime = 'nodejs';
/* آیکون از پایگاه داده می‌آید و باید بلافاصله پس از تغییر در پنل عوض شود */
export const dynamic = 'force-dynamic';

/**
 * manifest اپ — پویا ساخته می‌شود تا آیکونی که مدیر در پنل می‌گذارد بدون
 * دیپلوی دوباره روی صفحه‌ی خانه‌ی گوشی بنشیند.
 */
export async function GET() {
  const { iconUrl, maskableIconUrl } = await getBranding();

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
      { src: iconUrl, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: iconUrl, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: maskableIconUrl, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'رزرو زمین', url: '/booking', icons: [{ src: iconUrl, sizes: '192x192' }] },
      { name: 'بازی‌های باز', url: '/matches', icons: [{ src: iconUrl, sizes: '192x192' }] },
      { name: 'تورنومنت‌ها', url: '/tournaments', icons: [{ src: iconUrl, sizes: '192x192' }] },
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
