'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <button type="button" onClick={logout} disabled={loading} className="btn-danger w-full">
      {loading ? <Spinner /> : 'خروج از حساب کاربری'}
    </button>
  );
}
