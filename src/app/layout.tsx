import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { ThemeScript } from "@/components/theme/ThemeScript";
import { getBranding } from "@/lib/branding";
import { appUrl } from "@/lib/app-url";


export async function generateMetadata(): Promise<Metadata> {
  const { iconUrl } = await getBranding();
  return {
    metadataBase: new URL(appUrl() || "http://localhost:3000"),
    title: {
      default: "پرشین پدل | Persian Padel",
      template: "%s | پرشین پدل",
    },
    description:
      "باشگاه پدل پرشین پدل — رزرو زمین، کیف پول، تورنومنت‌ها و مدیریت جامعه بازیکنان پدل.",
    applicationName: "Persian Padel",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      /* برچسبی که در iOS زیر آیکون صفحه‌ی خانه می‌نشیند */
      title: "پرشین پدل",
      statusBarStyle: "black-translucent",
    },
    formatDetection: { telephone: false },
    icons: {
      icon: [{ url: iconUrl, sizes: "512x512", type: "image/png" }],
      /* آیکون «افزودن به صفحه‌ی خانه» در iOS */
      apple: [{ url: iconUrl, sizes: "180x180" }],
    },
    openGraph: {
      type: "website",
      locale: "fa_IR",
      siteName: "Persian Padel",
      title: "پرشین پدل | باشگاه پدل",
      description: "رزرو زمین، تورنومنت و مدیریت بازیکنان پدل",
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F7FC" },
    { media: "(prefers-color-scheme: dark)", color: "#080B1C" },
  ],
  width: "device-width",
  initialScale: 1,
  /* زوم عمدا آزاد است — قفل کردن آن مانع دسترس‌پذیری می‌شود */
  maximumScale: 5,
  /* تمام‌صفحه پشت ناچ و نوار خانه‌ی آیفون */
  viewportFit: "cover",
  /* هنگام باز شدن کیبورد موبایل، چیدمان جابه‌جا نشود */
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { logoUrl } = await getBranding();

  return (
    <html lang="fa" dir="rtl">
      <head>
        {/* فونت دانا محلی است؛ وزن‌های اصلی از پیش بارگذاری می‌شوند */}
        <link
          rel="preload"
          href="/fonts/Dana-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        <link
          rel="preload"
          href="/fonts/Dana-Bold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin=""
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <ThemeScript />
      </head>
      <body>
        <ToastProvider>
          {children}
          <InstallPrompt logoUrl={logoUrl} />
        </ToastProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
