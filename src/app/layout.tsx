import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import { ServiceWorkerRegistrar } from '@/components/pwa/ServiceWorkerRegistrar';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { ThemeScript } from '@/components/theme/ThemeScript';
import { SpeedInsights } from '@vercel/speed-insights/next';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'پرشین پدل | Persian Padel',
    template: '%s | پرشین پدل',
  },
  description:
    'باشگاه پدل پرشین پدل — رزرو زمین، کیف پول، تورنومنت‌ها و مدیریت جامعه بازیکنان پدل.',
  applicationName: 'Persian Padel',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    /* برچسبی که در iOS زیر آیکون صفحه‌ی خانه می‌نشیند */
    title: 'پرشین پدل',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    type: 'website',
    locale: 'fa_IR',
    siteName: 'Persian Padel',
    title: 'پرشین پدل | باشگاه پدل',
    description: 'رزرو زمین، تورنومنت و مدیریت بازیکنان پدل',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F9FC' },
    { media: '(prefers-color-scheme: dark)', color: '#090B0F' },
  ],
  width: 'device-width',
  initialScale: 1,
  /* زوم عمدا آزاد است — قفل کردن آن مانع دسترس‌پذیری می‌شود */
  maximumScale: 5,
  /* تمام‌صفحه پشت ناچ و نوار خانه‌ی آیفون */
  viewportFit: 'cover',
  /* هنگام باز شدن کیبورد موبایل، چیدمان جابه‌جا نشود */
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        {/* فونت دانا محلی است؛ وزن‌های اصلی از پیش بارگذاری می‌شوند */}
        <link rel="preload" href="/fonts/Dana-Regular.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/Dana-Bold.woff2" as="font" type="font/woff2" crossOrigin="" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <ThemeScript />
      </head>
      <body>
        <ToastProvider>
          {children}
          <InstallPrompt />
        </ToastProvider>
        <ServiceWorkerRegistrar />
        <SpeedInsights />
      </body>
    </html>
  );
}
