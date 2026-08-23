'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { PlayerLevel, Role, UserStatus } from '@prisma/client';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { LEVEL_LABEL, LEVEL_ORDER } from '@/lib/constants';
import { formatToman } from '@/lib/utils';
import { toFaDigits } from '@/lib/datetime';

export function UserAdminPanel({
  userId,
  firstName,
  lastName,
  level,
  role,
  status,
  balance,
  points,
}: {
  userId: string;
  firstName: string;
  lastName: string;
  level: PlayerLevel;
  role: Role;
  status: UserStatus;
  balance: string;
  points: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [savingUser, setSavingUser] = useState(false);
  const [savingWallet, setSavingWallet] = useState(false);
  const [savingPoints, setSavingPoints] = useState(false);

  async function post(url: string, body: unknown, method = 'POST') {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || 'عملیات ناموفق بود.');
    return json.data;
  }

  async function saveUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingUser(true);
    const form = new FormData(event.currentTarget);
    try {
      await post(
        `/api/admin/users/${userId}`,
        {
          firstName: String(form.get('firstName') || ''),
          lastName: String(form.get('lastName') || ''),
          level: String(form.get('level') || ''),
          role: String(form.get('role') || ''),
          status: String(form.get('status') || ''),
          ...(String(form.get('resetPassword') || '')
            ? { resetPassword: String(form.get('resetPassword')) }
            : {}),
        },
        'PATCH',
      );
      toast.success('اطلاعات کاربر به‌روزرسانی شد.');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در ذخیره اطلاعات.');
    } finally {
      setSavingUser(false);
    }
  }

  async function adjustWallet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingWallet(true);
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    try {
      const data = await post('/api/admin/wallet/adjust', {
        userId,
        amountToman: String(form.get('amount') || ''),
        direction: String(form.get('direction') || 'CREDIT'),
        description: String(form.get('description') || '') || undefined,
      });
      toast.success(`موجودی جدید: ${formatToman(BigInt(data.balance))}`);
      formEl.reset();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در تغییر موجودی.');
    } finally {
      setSavingWallet(false);
    }
  }

  async function adjustPoints(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPoints(true);
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    try {
      const data = await post('/api/admin/points/adjust', {
        userId,
        amount: Number(form.get('amount')),
        description: String(form.get('description') || '') || undefined,
      });
      toast.success(`امتیاز جدید: ${toFaDigits(data.points)}`);
      formEl.reset();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'خطا در تغییر امتیاز.');
    } finally {
      setSavingPoints(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ---- ویرایش کاربر ---- */}
      <form onSubmit={saveUser} className="card space-y-3 p-4">
        <h2 className="text-sm font-extrabold text-brand-800">ویرایش اطلاعات</h2>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="firstName">نام</label>
            <input id="firstName" name="firstName" defaultValue={firstName} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="lastName">نام خانوادگی</label>
            <input id="lastName" name="lastName" defaultValue={lastName} className="field" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="level">سطح بازیکن</label>
          <select id="level" name="level" defaultValue={level} className="field">
            {LEVEL_ORDER.map((l) => (
              <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
            ))}
          </select>
          <p className="helper">تغییر سطح فقط توسط مدیریت امکان‌پذیر است.</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="role">نقش</label>
            <select id="role" name="role" defaultValue={role} className="field">
              <option value="PLAYER">بازیکن</option>
              <option value="ADMIN">مدیر</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="status">وضعیت</label>
            <select id="status" name="status" defaultValue={status} className="field">
              <option value="ACTIVE">فعال</option>
              <option value="SUSPENDED">غیرفعال</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="resetPassword">تعیین رمز عبور جدید (اختیاری)</label>
          <input
            id="resetPassword" name="resetPassword" type="text" dir="ltr"
            className="field text-left" placeholder="خالی بگذارید تا تغییری نکند"
            autoComplete="off"
          />
        </div>

        <button type="submit" disabled={savingUser} className="btn-primary w-full">
          {savingUser ? <Spinner /> : 'ذخیره تغییرات'}
        </button>
      </form>

      {/* ---- کیف پول ---- */}
      <form onSubmit={adjustWallet} className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-brand-800">تغییر موجودی کیف پول</h2>
          <span className="num badge-brand">{formatToman(BigInt(balance))}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="wallet-amount">مبلغ (تومان)</label>
            <input
              id="wallet-amount" name="amount" inputMode="numeric" dir="ltr"
              className="field num text-left" placeholder="100000" required
            />
          </div>
          <div>
            <label className="label" htmlFor="direction">نوع</label>
            <select id="direction" name="direction" className="field" defaultValue="CREDIT">
              <option value="CREDIT">افزایش</option>
              <option value="DEBIT">کاهش</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="wallet-desc">توضیح</label>
          <input
            id="wallet-desc" name="description" className="field"
            placeholder="مثلاً: جبران خطای سیستمی"
          />
        </div>

        <button type="submit" disabled={savingWallet} className="btn-outline w-full">
          {savingWallet ? <Spinner /> : 'ثبت تغییر موجودی'}
        </button>
      </form>

      {/* ---- امتیاز ---- */}
      <form onSubmit={adjustPoints} className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-brand-800">تغییر امتیاز</h2>
          <span className="num badge-accent">{toFaDigits(points)}</span>
        </div>

        <div>
          <label className="label" htmlFor="points-amount">مقدار</label>
          <input
            id="points-amount" name="amount" type="number" dir="ltr"
            className="field num text-left" placeholder="50 یا 50-" required
          />
          <p className="helper">مقدار منفی برای کسر امتیاز وارد کنید.</p>
        </div>

        <div>
          <label className="label" htmlFor="points-desc">توضیح</label>
          <input
            id="points-desc" name="description" className="field"
            placeholder="مثلاً: پاداش ویژه باشگاه"
          />
        </div>

        <button type="submit" disabled={savingPoints} className="btn-outline w-full">
          {savingPoints ? <Spinner /> : 'ثبت تغییر امتیاز'}
        </button>
      </form>
    </div>
  );
}
