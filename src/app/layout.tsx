import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import { ServiceWorkerRegistrar } from '@/components/pwa/ServiceWorkerRegistrar';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';

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
    title: 'Persian Padel',
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
  themeColor: '#003049',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&display=swap"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <ToastProvider>
          {children}
          <InstallPrompt />
        </ToastProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
