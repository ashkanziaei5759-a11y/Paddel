import type { Metadata } from 'next';
import { requireAdminPage } from '@/lib/auth/rbac';
import { getBranding, DEFAULT_BRANDING } from '@/lib/branding';
import { BrandingForm } from './BrandingForm';

export const metadata: Metadata = { title: 'ظاهر اپ' };
export const dynamic = 'force-dynamic';

/**
 * تعویض لوگو، آیکون اپ و پوستر صفحه‌ی ورود — بدون دیپلوی دوباره.
 * تصویرها در پایگاه داده می‌نشینند و بلافاصله روی همه‌ی دستگاه‌ها عوض می‌شوند.
 */
export default async function AdminBrandingPage() {
  await requireAdminPage();
  const branding = await getBranding();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-black text-brand-800">ظاهر اپ</h1>
        <p className="mt-1 text-[11.5px] font-semibold leading-6 text-brand-400">
          لوگو، آیکون اپ و پوستر صفحه‌ی ورود را از همین‌جا عوض کنید. تصویر در پایگاه
          داده ذخیره می‌شود و بلافاصله روی همه‌ی دستگاه‌ها اعمال می‌گردد — نیازی به
          دیپلوی دوباره نیست.
        </p>
      </header>

      <BrandingForm initial={branding} defaults={DEFAULT_BRANDING} />
    </div>
  );
}
