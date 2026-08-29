'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { ImagePicker } from '@/components/media/ImagePicker';
import { useToast } from '@/components/ui/Toast';
import { maskPhone } from '@/lib/utils';

export function SettingsForms({
  firstName,
  lastName,
  bio,
  avatarUrl,
  phone,
  gender,
}: {
  firstName: string;
  lastName: string;
  bio: string;
  avatarUrl: string;
  phone: string;
  gender: 'MALE' | 'FEMALE' | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [savingProfile, setSavingProfile] = useState(false);
  const [genderChoice, setGenderChoice] = useState<'MALE' | 'FEMALE' | null>(gender);
  const [avatar, setAvatar] = useState<string | null>(avatarUrl || null);
  const [savingPassword, setSavingPassword] = useState(false);

  /**
   * عکس پروفایل بلافاصله ذخیره می‌شود، نه با دکمه‌ی «ذخیره تغییرات» پایین فرم.
   * پیش از این، کاربر عکس را آپلود می‌کرد، پیام «تصویر ذخیره شد» را می‌دید و
   * صفحه را ترک می‌کرد — و عکس هرگز به پروفایلش نمی‌رسید.
   */
  async function saveAvatar(url: string | null) {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl: url }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.error || 'ذخیره‌ی عکس ناموفق بود.');

    setAvatar(url);
    router.refresh();
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    const form = new FormData(event.currentTarget);

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: String(form.get('firstName') || ''),
          lastName: String(form.get('lastName') || ''),
          bio: String(form.get('bio') || '') || null,
          avatarUrl: avatar,
          gender: genderChoice,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) { toast.error(json.error || 'ذخیره ناموفق بود.'); return; }
      toast.success('اطلاعات شما به‌روزرسانی شد.');
      router.refresh();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPassword(true);
    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    try {
      const res = await fetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: String(form.get('currentPassword') || ''),
          newPassword: String(form.get('newPassword') || ''),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) { toast.error(json.error || 'تغییر رمز ناموفق بود.'); return; }
      toast.success('رمز عبور شما تغییر کرد.');
      formEl.reset();
    } catch {
      toast.error('ارتباط با سرور برقرار نشد.');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={saveProfile} className="card space-y-4 p-5">
        <h2 className="text-sm font-extrabold text-brand-800">اطلاعات شخصی</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="firstName">نام</label>
            <input id="firstName" name="firstName" defaultValue={firstName} className="field" required />
          </div>
          <div>
            <label className="label" htmlFor="lastName">نام خانوادگی</label>
            <input id="lastName" name="lastName" defaultValue={lastName} className="field" required />
          </div>
        </div>

        <div>
          <span className="label">عکس پروفایل</span>
          <ImagePicker
            kind="AVATAR"
            value={avatar}
            onChange={saveAvatar}
            label="انتخاب از گالری"
            allowCutout
            hint="عکسی که چهره و بالاتنه در آن دیده شود بهترین نتیجه را می‌دهد."
          />
        </div>

        <div>
          <span className="label">جنسیت</span>
          <p className="mb-2 text-[10.5px] font-semibold text-brand-300">
            اختیاری — فقط برای تفکیک جدول رنکینگ استفاده می‌شود.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'MALE' as const, label: 'مرد' },
              { value: 'FEMALE' as const, label: 'زن' },
              { value: null, label: 'نگفتن' },
            ]).map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setGenderChoice(option.value)}
                aria-pressed={genderChoice === option.value}
                className={`rounded-2xl py-3 text-xs font-black transition ${
                  genderChoice === option.value
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-muted text-brand-400'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="bio">درباره من</label>
          <textarea
            id="bio" name="bio" defaultValue={bio} rows={3} maxLength={240}
            className="field resize-none" placeholder="مثلاً: بازیکن پدل از سال ۱۴۰۰"
          />
        </div>

        <button type="submit" disabled={savingProfile} className="btn-primary w-full">
          {savingProfile ? <Spinner /> : 'ذخیره تغییرات'}
        </button>
      </form>

      <section className="card p-5">
        <h2 className="text-sm font-extrabold text-brand-800">شماره موبایل</h2>
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-surface-muted px-4 py-3">
          <span className="num flex-1 text-xs font-bold text-brand-700" dir="ltr">
            {phone ? maskPhone(phone) : '—'}
          </span>
          <span className="badge-success">تأیید شده ✓</span>
        </div>
        <p className="helper mt-2">
          شماره موبایل تأییدشده ثابت است. برای تغییر آن با مدیریت باشگاه تماس بگیرید.
        </p>
      </section>

      <form onSubmit={changePassword} className="card space-y-4 p-5">
        <h2 className="text-sm font-extrabold text-brand-800">تغییر رمز عبور</h2>

        <div>
          <label className="label" htmlFor="currentPassword">رمز عبور فعلی</label>
          <input
            id="currentPassword" name="currentPassword" type="password" dir="ltr"
            autoComplete="current-password" className="field text-left" required
          />
        </div>

        <div>
          <label className="label" htmlFor="newPassword">رمز عبور جدید</label>
          <input
            id="newPassword" name="newPassword" type="password" dir="ltr"
            autoComplete="new-password" className="field text-left" required
          />
          <p className="helper">حداقل ۸ کاراکتر، شامل حرف انگلیسی و عدد</p>
        </div>

        <button type="submit" disabled={savingPassword} className="btn-outline w-full">
          {savingPassword ? <Spinner /> : 'تغییر رمز عبور'}
        </button>
      </form>
    </div>
  );
}
