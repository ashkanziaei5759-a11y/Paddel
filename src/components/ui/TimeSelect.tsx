import { toFaDigits } from '@/lib/datetime';

/** بخش روز برای خواناتر شدن ساعت ۲۴ساعته */
function partOfDay(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60);
  if (h < 5) return 'بامداد';
  if (h < 12) return 'صبح';
  if (h < 14) return 'ظهر';
  if (h < 18) return 'عصر';
  return 'شب';
}

/** برچسب فارسی یک ساعت؛ ۱۴۴۰ یعنی نیمه‌شب و بیشتر از آن یعنی بامداد روز بعد */
export function timeLabel(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const hhmm = toFaDigits(
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
  );
  if (minutes === 1440) return `${toFaDigits('24:00')} — نیمه‌شب`;
  if (minutes > 1440) return `${hhmm} بامداد (روز بعد)`;
  return `${hhmm} ${partOfDay(m)}`;
}

/**
 * انتخاب ساعت به‌صورت ۲۴ساعته با ارقام فارسی.
 *
 * ورودی type="time" مرورگر به زبان سیستم (اغلب AM/PM انگلیسی) نشان داده
 * می‌شود و «۲۴:۰۰» را نمی‌پذیرد؛ این فهرست هر دو مشکل را ندارد. مقدارِ
 * فرم، تعداد دقیقه از ابتدای روز است.
 */
export function TimeSelect({
  id,
  name,
  defaultValue,
  from = 0,
  to = 1425,
  step = 15,
  className,
}: {
  id: string;
  name: string;
  defaultValue: number;
  from?: number;
  to?: number;
  step?: number;
  className?: string;
}) {
  const options: number[] = [];
  for (let m = from; m <= to; m += step) options.push(m);
  /* مقداری که با گام فهرست جور نیست (مثلاً ۲۳:۵۹ قدیمی) هم از دست نرود */
  if (!options.includes(defaultValue)) {
    options.push(defaultValue);
    options.sort((a, b) => a - b);
  }
  return (
    <select id={id} name={name} defaultValue={defaultValue} className={className ?? 'field num'}>
      {options.map((m) => (
        <option key={m} value={m}>
          {timeLabel(m)}
        </option>
      ))}
    </select>
  );
}

/** ساعت ۲۴ساعته‌ی کوتاه با ارقام فارسی (بدون بخش روز) */
function hhmm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return toFaDigits(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
}

/**
 * پیش‌نمایش سانس‌ها از روی ساعت شروع و پایان و مدت سانس، تا مدیر قبل از
 * ذخیره ببیند آخرین سانس چه ساعتی است (مثلاً با سانس ۹۰ دقیقه‌ای و پایان
 * نیمه‌شب، آخرین سانس ۲۱:۳۰ تا ۲۳:۰۰ است، نه ۲۳:۰۰).
 */
export function SlotPreview({ opening, closing, duration }: { opening: number; closing: number; duration: number }) {
  if (!duration || duration < 15 || closing <= opening) {
    return <p className="helper text-danger">ساعت پایان باید بعد از ساعت شروع باشد.</p>;
  }
  const count = Math.floor((closing - opening) / duration);
  if (count === 0) return <p className="helper text-danger">در این بازه هیچ سانسی جا نمی‌شود.</p>;
  const lastStart = opening + (count - 1) * duration;
  const unused = closing - (opening + count * duration);
  return (
    <p className="helper num leading-6">
      {toFaDigits(count)} سانس در روز — اولین {hhmm(opening)} و آخرین {hhmm(lastStart)} تا{' '}
      {hhmm(lastStart + duration)}
      {unused > 0 && ` (${toFaDigits(unused)} دقیقه‌ی آخر کمتر از یک سانس است و رزرو نمی‌شود)`}
    </p>
  );
}

/** خواندن ساعت‌ها از فرم برای پیش‌نمایش زنده */
export function readHours(form: HTMLFormElement) {
  const data = new FormData(form);
  return {
    opening: Number(data.get('opening')),
    closing: Number(data.get('closing')),
    duration: Number(data.get('slotDurationMinutes')),
  };
}
