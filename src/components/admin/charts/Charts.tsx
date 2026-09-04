import { toFaDigits } from '@/lib/datetime';
import { cn } from '@/lib/utils';

/**
 * نمودارهای پنل مدیریت.
 *
 * عمداً بدون کتابخانه‌ی نمودار نوشته شده‌اند: SVG ساده چند کیلوبایت است، در
 * حالی که کتابخانه‌های نمودار صدها کیلوبایت به بسته‌ی اپ اضافه می‌کنند —
 * روی اینترنت موبایل ایران هزینه‌ی سنگینی است. همه سرور-کامپوننت‌اند، پس
 * هیچ JavaScript‌ای به مرورگر نمی‌رود.
 *
 * رنگ‌ها از توکن‌های تم می‌آیند تا در تم روشن و تیره هر دو خوانا بمانند، و
 * هر نمودار در کنار تصویر، عدد هم دارد؛ رنگ به‌تنهایی حامل معنا نیست.
 */

export interface SeriesPoint {
  label: string;
  value: number;
}

/** ستونی — برای سری‌های زمانی مثل درآمد یا تعداد رزرو در روز */
export function BarSeries({
  title,
  subtitle,
  points,
  format,
  accent = 'electric',
}: {
  title: string;
  subtitle?: string;
  points: SeriesPoint[];
  format: (value: number) => string;
  accent?: 'electric' | 'accent' | 'success';
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const total = points.reduce((sum, p) => sum + p.value, 0);

  const fill =
    accent === 'accent' ? 'bg-accent' : accent === 'success' ? 'bg-success' : 'bg-electric-500';

  return (
    <section className="card p-4">
      <ChartHead title={title} subtitle={subtitle} total={format(total)} />

      {/* جدول پنهانِ هم‌ارز، برای صفحه‌خوان‌ها */}
      <div className="mt-4 flex h-[132px] items-end gap-1" role="img" aria-label={`${title}: ${points.map((p) => `${p.label} ${format(p.value)}`).join('، ')}`}>
        {points.map((p, i) => (
          <div key={i} className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5">
            <div
              className={cn('w-full rounded-t-md transition-all', p.value > 0 ? fill : 'bg-brand-100')}
              style={{ height: `${Math.max(p.value > 0 ? 6 : 3, (p.value / max) * 100)}%` }}
            />
            <span className="num block truncate text-center text-[8.5px] font-bold text-brand-300">
              {p.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export interface RankRow {
  id: string;
  name: string;
  /** خط دوم — مثلاً سطح بازیکن یا نام زمین */
  meta?: string;
  value: number;
}

/** میله‌های افقی — برای رتبه‌بندی افراد یا زمین‌ها */
export function RankBars({
  title,
  subtitle,
  rows,
  format,
  emptyText = 'داده‌ای برای نمایش نیست.',
}: {
  title: string;
  subtitle?: string;
  rows: RankRow[];
  format: (value: number) => string;
  emptyText?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <section className="card p-4">
      <ChartHead title={title} subtitle={subtitle} />

      {rows.length === 0 ? (
        <p className="mt-3 text-[11.5px] font-semibold text-brand-300">{emptyText}</p>
      ) : (
        <ol className="mt-3 space-y-2.5">
          {rows.map((row, index) => (
            <li key={row.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="num shrink-0 text-[10px] font-black text-brand-300">
                  {toFaDigits(index + 1)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] font-extrabold text-brand-700">
                  {row.name}
                </span>
                <span className="num shrink-0 text-[11px] font-black text-brand-800">
                  {format(row.value)}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-electric-gradient"
                  style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }}
                />
              </div>
              {row.meta && (
                <p className="mt-0.5 text-[10px] font-semibold text-brand-300">{row.meta}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** توزیع دسته‌ای — مثلاً چند بازیکن در هر سطح */
export function DistributionBars({
  title,
  subtitle,
  rows,
  emptyText = 'هنوز داده‌ای ثبت نشده است.',
}: {
  title: string;
  subtitle?: string;
  rows: { label: string; value: number }[];
  emptyText?: string;
}) {
  const total = rows.reduce((sum, r) => sum + r.value, 0);

  if (rows.length === 0 || total === 0) {
    return (
      <section className="card p-4">
        <ChartHead title={title} subtitle={subtitle} />
        <p className="mt-3 text-[11.5px] font-semibold text-brand-300">{emptyText}</p>
      </section>
    );
  }

  return (
    <section className="card p-4">
      <ChartHead title={title} subtitle={subtitle} total={toFaDigits(total)} />

      <div className="mt-3 space-y-2">
        {rows.map((r) => {
          const share = total > 0 ? (r.value / total) * 100 : 0;
          return (
            <div key={r.label} className="flex items-center gap-3">
              <span
                dir="ltr"
                className="w-10 shrink-0 text-[11px] font-black text-brand-600"
              >
                {r.label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-electric-gradient"
                  style={{ width: `${Math.max(r.value > 0 ? 3 : 0, share)}%` }}
                />
              </div>
              <span className="num w-16 shrink-0 text-left text-[10.5px] font-bold text-brand-400">
                {toFaDigits(r.value)} ({toFaDigits(Math.round(share))}٪)
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ChartHead({
  title,
  subtitle,
  total,
}: {
  title: string;
  subtitle?: string;
  total?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[13px] font-black text-brand-800">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-[10.5px] font-semibold text-brand-400">{subtitle}</p>
        )}
      </div>
      {total && <span className="num shrink-0 text-sm font-black text-brand-800">{total}</span>}
    </div>
  );
}

/**
 * کاشی عدد — عدد بزرگ، تغییر نسبت به دوره‌ی قبل، و یک نمودار ریز روند.
 *
 * درصد تغییر همیشه در کنار خودِ عدد می‌آید و رنگ به‌تنهایی معنا را نمی‌رساند:
 * علامت ▲/▼ هم هست، تا برای کسی که رنگ را تشخیص نمی‌دهد هم خوانا باشد.
 */
export function KpiTile({
  label,
  value,
  hint,
  delta,
  spark,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  /** درصد تغییر نسبت به دوره‌ی قبل؛ undefined یعنی دوره‌ی قبلی داده‌ای نداشته */
  delta?: number;
  spark?: number[];
  tone?: 'neutral' | 'accent' | 'success';
}) {
  const up = delta !== undefined && delta > 0;
  const down = delta !== undefined && delta < 0;

  return (
    <div className="card p-3.5">
      <p className="truncate text-[10.5px] font-bold text-brand-400">{label}</p>
      <p
        className={cn(
          'num mt-1 truncate text-[17px] font-black leading-tight',
          tone === 'accent' ? 'text-accent-600' : tone === 'success' ? 'text-success' : 'text-brand-800',
        )}
      >
        {value}
      </p>

      {delta !== undefined && (
        <p
          className={cn(
            'num mt-1 text-[10px] font-black',
            up ? 'text-success' : down ? 'text-danger' : 'text-brand-300',
          )}
        >
          {up ? '▲' : down ? '▼' : '='} {toFaDigits(Math.abs(Math.round(delta)))}٪
          <span className="font-bold text-brand-300"> نسبت به دوره‌ی قبل</span>
        </p>
      )}

      {hint && !delta && (
        <p className="mt-1 truncate text-[10px] font-semibold text-brand-300">{hint}</p>
      )}

      {spark && spark.length > 1 && <Sparkline points={spark} />}
    </div>
  );
}

/** نمودار ریز روند — بدون محور و برچسب، فقط شکل تغییر */
function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const step = 100 / (points.length - 1);

  const line = points
    .map((v, i) => `${(i * step).toFixed(2)},${(28 - ((v - min) / span) * 26).toFixed(2)}`)
    .join(' ');

  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className="mt-2 h-7 w-full text-electric-500"
      aria-hidden="true"
    >
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * دو سری روی یک محور — مثلاً درآمد در برابر بازگشت وجه.
 * ستون‌ها کنار هم می‌نشینند تا مقایسه‌ی روزبه‌روز ممکن باشد.
 */
export function GroupedBars({
  title,
  subtitle,
  labels,
  seriesA,
  seriesB,
  format,
}: {
  title: string;
  subtitle?: string;
  labels: string[];
  seriesA: { name: string; values: number[] };
  seriesB: { name: string; values: number[] };
  format: (value: number) => string;
}) {
  const max = Math.max(1, ...seriesA.values, ...seriesB.values);
  const sumA = seriesA.values.reduce((s, v) => s + v, 0);
  const sumB = seriesB.values.reduce((s, v) => s + v, 0);

  return (
    <section className="card p-4">
      <ChartHead title={title} subtitle={subtitle} />

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <Legend swatch="bg-electric-500" name={seriesA.name} value={format(sumA)} />
        <Legend swatch="bg-accent" name={seriesB.name} value={format(sumB)} />
      </div>

      <div
        className="mt-3 flex h-[120px] items-end gap-1"
        role="img"
        aria-label={`${title}: ${seriesA.name} ${format(sumA)}، ${seriesB.name} ${format(sumB)}`}
      >
        {labels.map((label, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5">
            <div className="flex h-full items-end gap-[2px]">
              <div
                className="flex-1 rounded-t-sm bg-electric-500"
                style={{ height: `${Math.max(seriesA.values[i] > 0 ? 5 : 2, (seriesA.values[i] / max) * 100)}%` }}
              />
              <div
                className="flex-1 rounded-t-sm bg-accent"
                style={{ height: `${Math.max(seriesB.values[i] > 0 ? 5 : 2, (seriesB.values[i] / max) * 100)}%` }}
              />
            </div>
            <span className="num block truncate text-center text-[8.5px] font-bold text-brand-300">
              {label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Legend({ swatch, name, value }: { swatch: string; name: string; value: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-2 w-2 shrink-0 rounded-full', swatch)} aria-hidden="true" />
      <span className="text-[10.5px] font-bold text-brand-400">{name}</span>
      <span className="num text-[10.5px] font-black text-brand-700">{value}</span>
    </span>
  );
}
