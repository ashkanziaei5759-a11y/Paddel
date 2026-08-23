import { toFaDigits } from '@/lib/datetime';
import { cn } from '@/lib/utils';

export interface StandingRow {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  points: number;
  rank: number | null;
  highlight?: boolean;
}

export function StandingsTable({ title, rows }: { title?: string; rows: StandingRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="card overflow-hidden">
      {title && (
        <div className="border-b border-brand-50 px-4 py-3">
          <h3 className="text-xs font-extrabold text-brand-800">{title}</h3>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-right">
          <thead>
            <tr className="bg-surface-muted text-[10px] font-black text-brand-400">
              <th className="px-3 py-2.5">#</th>
              <th className="px-2 py-2.5 text-right">تیم</th>
              <th className="px-2 py-2.5 text-center">بازی</th>
              <th className="px-2 py-2.5 text-center">برد</th>
              <th className="px-2 py-2.5 text-center">باخت</th>
              <th className="px-2 py-2.5 text-center">ست</th>
              <th className="px-3 py-2.5 text-center">امتیاز</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-50">
            {rows.map((row, index) => (
              <tr
                key={row.teamId}
                className={cn(
                  'text-xs font-bold text-brand-700',
                  row.highlight && 'bg-accent-50/60',
                  index < 2 && 'font-black',
                )}
              >
                <td className="num px-3 py-3 text-brand-400">{toFaDigits(row.rank ?? index + 1)}</td>
                <td className="max-w-[140px] truncate px-2 py-3 text-brand-800">{row.teamName}</td>
                <td className="num px-2 py-3 text-center">{toFaDigits(row.played)}</td>
                <td className="num px-2 py-3 text-center text-success">{toFaDigits(row.won)}</td>
                <td className="num px-2 py-3 text-center text-danger/70">{toFaDigits(row.lost)}</td>
                <td className="num px-2 py-3 text-center text-brand-400">
                  {toFaDigits(row.setsFor)}−{toFaDigits(row.setsAgainst)}
                </td>
                <td className="num px-3 py-3 text-center text-sm font-black text-brand-800">
                  {toFaDigits(row.points)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
