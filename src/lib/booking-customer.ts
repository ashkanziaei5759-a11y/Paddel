/**
 * نام مشتریِ یک رزرو برای نمایش.
 *
 * رزرو یا به حساب یک بازیکن وصل است، یا (در رزرو تلفنی) به نام یک مشتری
 * متفرقه ثبت شده که حساب کاربری ندارد. هر جا نام صاحب رزرو نشان داده می‌شود
 * از این تابع استفاده کنید تا هر دو حالت یکسان نمایش داده شوند.
 */
export interface BookingCustomerLike {
  guestName?: string | null;
  user?: {
    username?: string | null;
    profile?: { firstName?: string | null; lastName?: string | null } | null;
  } | null;
}

export const GUEST_LABEL = 'متفرقه';

export function bookingCustomerName(b: BookingCustomerLike): string {
  if (b.user) {
    const full = `${b.user.profile?.firstName ?? ''} ${b.user.profile?.lastName ?? ''}`.trim();
    return full || b.user.username || '—';
  }
  return b.guestName?.trim() || 'مشتری متفرقه';
}

export function isGuestBooking(b: { userId?: string | null }): boolean {
  return !b.userId;
}
