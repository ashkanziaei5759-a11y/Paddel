import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /**
   * خروجی مستقل — برای Docker، Vercel و پلتفرم‌هایی مانند لیارا و آروان.
   *
   * روی cPanel این حالت به درد نمی‌خورد: آنجا Passenger اپ را اجرا می‌کند و
   * ما با app.js سرور را خودمان بالا می‌آوریم، که با خروجی standalone سازگار
   * نیست. پس هنگام ساخت برای cPanel، CPANEL=1 بگذارید تا خروجی معمولی
   * ساخته شود.
   */
  ...(process.env.CPANEL === '1' ? {} : { output: 'standalone' as const }),
  /**
   * ردیاب وابستگی‌های Next موتور کوئری Prisma را به‌صورت خودکار پیدا نمی‌کند،
   * چون در زمان اجرا و بر اساس نام فایل بارگذاری می‌شود. بدون این تنظیم،
   * ایمیج ساخته می‌شود اما هنگام نخستین کوئری خطای «Query engine not found» می‌دهد.
   */
  outputFileTracingIncludes: {
    '/**': ['./node_modules/.prisma/client/**'],
  },
  experimental: {
    optimizePackageImports: ['@prisma/client'],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
