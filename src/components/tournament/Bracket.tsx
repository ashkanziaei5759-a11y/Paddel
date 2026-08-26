import { MATCH_STAGE_LABEL } from '@/lib/constants';
import { toFaDigits } from '@/lib/datetime';
import { cn } from '@/lib/utils';

export interface BracketMatch {
  id: string;
  stage: keyof typeof MATCH_STAGE_LABEL;
  round: number;
  slotInRound: number;
  teamAName: string | null;
  teamBName: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerTeamId: string | null;
  teamAId: string | null;
  teamBId: string | null;
  status: string;
}

/** نمایش براکت حذفی به‌صورت ستون‌های افقی و قابل اسکرول */
export function Bracket({ matches }: { matches: BracketMatch[] }) {
  if (matches.length === 0) return null;

  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);

  return (
    <div className="card overflow-x-auto p-4">
      <div className="flex min-w-max gap-4">
        {rounds.map((round) => {
          const roundMatches = matches
            .filter((m) => m.round === round)
            .sort((a, b) => a.slotInRound - b.slotInRound);

          return (
            <div key={round} className="flex w-52 shrink-0 flex-col gap-3">
              <p className="text-center text-[11px] font-black text-brand-400">
                {MATCH_STAGE_LABEL[roundMatches[0].stage]}
              </p>
              <div className="flex flex-1 flex-col justify-around gap-3">
                {roundMatches.map((match) => (
                  <div
                    key={match.id}
                    className="overflow-hidden rounded-2xl bg-surface-muted ring-1 ring-brand-100"
                  >
                    <Side
                      name={match.teamAName}
                      score={match.scoreA}
                      isWinner={Boolean(match.winnerTeamId && match.winnerTeamId === match.teamAId)}
                    />
                    <div className="h-px bg-brand-100" />
                    <Side
                      name={match.teamBName}
                      score={match.scoreB}
                      isWinner={Boolean(match.winnerTeamId && match.winnerTeamId === match.teamBId)}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Side({
  name,
  score,
  isWinner,
}: {
  name: string | null;
  score: number | null;
  isWinner: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 px-3 py-2.5',
        isWinner ? 'bg-accent-50' : 'bg-card',
      )}
    >
      <span
        className={cn(
          'truncate text-[11px]',
          name ? (isWinner ? 'font-black text-accent-700' : 'font-bold text-brand-700') : 'font-bold text-brand-200',
        )}
      >
        {name ?? 'در انتظار'}
      </span>
      <span
        className={cn(
          'num shrink-0 text-xs font-black',
          isWinner ? 'text-accent-600' : 'text-brand-400',
        )}
      >
        {score !== null ? toFaDigits(score) : '—'}
      </span>
    </div>
  );
}
