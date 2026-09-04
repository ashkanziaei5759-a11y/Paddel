"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Smartphone, Sparkles } from "lucide-react";
import { ImagePicker } from "@/components/media/ImagePicker";
import { Dot } from "@/components/ui/Dot";
import { useToast } from "@/components/ui/Toast";
import type { Branding } from "@/lib/branding";

type Field = keyof Branding;

/**
 * سه بخش: صفحه‌ی ورود، لوگو، آیکون نصب.
 *
 * هر تصویر بلافاصله پس از آپلود ذخیره می‌شود؛ دکمه‌ی «ذخیره»ی جداگانه‌ای وجود
 * ندارد تا کسی تصویر را آپلود کند و فراموش کند ثبتش کند.
 */
export function BrandingForm({
  initial,
  defaults,
}: {
  initial: Branding;
  defaults: Branding;
}) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<Branding>(initial);

  /** آیا این تصویر را مدیر گذاشته یا هنوز فایل پیش‌فرض است؟ */
  const isCustom = (field: Field) => values[field] !== defaults[field];

  async function save(field: Field, url: string | null) {
    const res = await fetch("/api/admin/branding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: url }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok)
      throw new Error(json.error || "ذخیره‌ی تصویر ناموفق بود.");

    setValues((prev) => ({ ...prev, [field]: url ?? defaults[field] }));
    toast.success("تصویر اعمال شد.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Section
        icon={<Smartphone className="h-4 w-4" strokeWidth={2.2} />}
        title="پوستر صفحه‌ی ورود"
        note="دو تصویر جدا بدهید تا روی هر دستگاه کامل و بدون کشیدگی دیده شود. اگر فقط عکس گوشی را بگذارید، همان روی لپ‌تاپ هم استفاده می‌شود."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Slot
            label="گوشی — عمودی"
            size="۱۰۸۰×۱۹۲۰" ratio="۹:۱۶"
            help="فرم ورود پایینِ صفحه می‌نشیند، پس سوژه را در یک‌سومِ بالای کادر بگذارید تا پشت کارت پنهان نشود."
            custom={isCustom("loginPosterUrl")}
          >
            <ImagePicker
              value={isCustom("loginPosterUrl") ? values.loginPosterUrl : null}
              onChange={(url) => save("loginPosterUrl", url)}
              kind="BRANDING"
              aspect="tall"
              label="پوستر گوشی"
            />
          </Slot>

          <Slot
            label="لپ‌تاپ — افقی"
            size="۱۹۲۰×۱۰۸۰" ratio="۱۶:۹"
            help="روی نمایشگر بزرگ، فرم سمت راست می‌نشیند؛ سوژه را کمی به چپ کادر ببرید."
            custom={isCustom("loginPosterWideUrl")}
          >
            <ImagePicker
              value={
                isCustom("loginPosterWideUrl")
                  ? values.loginPosterWideUrl
                  : null
              }
              onChange={(url) => save("loginPosterWideUrl", url)}
              kind="BRANDING"
              aspect="wide"
              label="پوستر لپ‌تاپ"
            />
          </Slot>
        </div>
      </Section>

      <Section
        icon={<Sparkles className="h-4 w-4" strokeWidth={2.2} />}
        title="لوگوی داخل اپ"
        note="همان نشانی که بالای صفحه‌ی ورود، پنل مدیریت و پیام نصب دیده می‌شود."
      >
        <Slot
          label="لوگو"
          size="۵۱۲×۵۱۲" ratio="۱:۱"
          help="PNG با پس‌زمینه‌ی شفاف بهترین نتیجه را می‌دهد."
          custom={isCustom("logoUrl")}
        >
          <ImagePicker
            value={isCustom("logoUrl") ? values.logoUrl : null}
            onChange={(url) => save("logoUrl", url)}
            kind="BRANDING"
            aspect="square"
            label="لوگو"
          />
        </Slot>
      </Section>

      <Section
        icon={<Monitor className="h-4 w-4" strokeWidth={2.2} />}
        title="آیکون نصب روی گوشی"
        note="این تصویر روی صفحه‌ی خانه‌ی آیفون و اندروید می‌نشیند. پس از تغییر، کسانی که اپ را از قبل نصب کرده‌اند باید یک بار حذف و دوباره اضافه کنند."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Slot
            label="آیکون اپ"
            size="۵۱۲×۵۱۲" ratio="۱:۱"
            help="روی iOS گوشه‌ها خودکار گرد می‌شوند؛ خودتان گردشان نکنید."
            custom={isCustom("iconUrl")}
          >
            <ImagePicker
              value={isCustom("iconUrl") ? values.iconUrl : null}
              onChange={(url) => save("iconUrl", url)}
              kind="BRANDING"
              aspect="square"
              label="آیکون"
            />
          </Slot>

          <Slot
            label="آیکون اندروید (maskable)"
            size="۵۱۲×۵۱۲" ratio="۱:۱"
            help="اندروید آیکون را دایره یا چندضلعی می‌برد. لوگو را در ۸۰٪ میانی نگه دارید تا لبه‌اش بریده نشود."
            custom={isCustom("maskableIconUrl")}
          >
            <ImagePicker
              value={
                isCustom("maskableIconUrl") ? values.maskableIconUrl : null
              }
              onChange={(url) => save("maskableIconUrl", url)}
              kind="BRANDING"
              aspect="square"
              label="آیکون اندروید"
            />
          </Slot>
        </div>
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  note,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card space-y-4 p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-[13px] font-black text-brand-800">{title}</h2>
          <p className="mt-1 text-[11px] font-semibold leading-6 text-brand-400">
            {note}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Slot({
  label,
  size,
  ratio,
  help,
  custom,
  children,
}: {
  label: string;
  size: string;
  ratio: string;
  help: string;
  custom: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-surface-muted p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-[11.5px] font-black text-brand-700">{label}</p>
        {!custom && (
          <span className="rounded-lg bg-brand-100 px-1.5 py-0.5 text-[9px] font-black text-brand-500">
            پیش‌فرض
          </span>
        )}
      </div>
      {/* عدد در جمله‌ی راست‌به‌چپ وارونه چیده می‌شود؛ bdi با dir="ltr"
          «عرض×ارتفاع» را همان‌طور که هست نگه می‌دارد */}
      <p className="num mb-3 text-[10.5px] font-bold text-brand-400">
        <bdi dir="ltr">{size}</bdi>
        <Dot />
        <bdi dir="ltr">{ratio}</bdi>
      </p>
      {children}
      <p className="mt-2.5 text-[10.5px] font-semibold leading-6 text-brand-300">
        {help}
      </p>
    </div>
  );
}
