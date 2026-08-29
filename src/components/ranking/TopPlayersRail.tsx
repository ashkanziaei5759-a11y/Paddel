import type { Gender, PlayerLevel } from '@prisma/client';
import { Avatar } from '@/components/ui/Avatar';
import { LEVEL_LABEL } from '@/lib/constants';
import { formatNumber, cn } from '@/lib/utils';
import { toFaDigits } from '@/lib/datetime';

export interface TopPlayer {
  userId: string;
  rank: number;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  level: PlayerLevel;
  points: number;
  gender: Gender | null;
}

/**
 * نوار افقی نفرات برتر.
 *
 * عکس بازیکن از بالای کارت بیرون می‌زند، بنابراین خودِ کارت نمی‌تواند
 * overflow-hidden باشد؛ رنگ روی یک لایه‌ی جداگانه کشیده می‌شود تا هم گوشه‌ها
 * گرد بماند و هم عکس آزاد باشد. با عکسِ پس‌زمینه‌حذف‌شده بهترین نتیجه را می‌دهد.
 */
export function TopPlayersRail({ players }: { players: TopPlayer[] }) {
  if (players.length === 0) return null;

  return (
    <div className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 pt-9">
      {players.map((player) => (
        <PlayerCard key={player.userId} player={player} />
      ))}
    </div>
  );
}

function PlayerCard({ player }: { player: TopPlayer }) {
  const women = player.gender === 'FEMALE';

  return (
    <div className="relative w-[248px] shrink-0 snap-start">
      <div
        className={cn(
          'absolute inset-0 overflow-hidden rounded-3xl',
          women
            ? 'bg-[linear-gradient(135deg,#3B1461_0%,#5B21A6_55%,#7C3AED_100%)]'
            : 'bg-[linear-gradient(135deg,#0A2A4A_0%,#0047A3_55%,#007FFF_100%)]',
        )}
      >
        <span className="absolute inset-0 bg-court-lines opacity-40" />
      </div>

      <div className="pointer-events-none absolute -top-9 left-3 h-[128px] w-[92px]">
        {player.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.avatarUrl}
            alt=""
            className="h-full w-full object-contain object-bottom drop-shadow-[0_10px_16px_rgba(0,0,0,.45)]"
          />
        ) : (
          <div className="flex h-full w-full items-end justify-center">
            <Avatar
              firstName={player.firstName}
              lastName={player.lastName}
              size="lg"
              className="ring-2 ring-white/25"
            />
          </div>
        )}
      </div>

      <div className="relative flex h-[104px] flex-col justify-center gap-1 py-3 pr-4 ps-[104px]">
        <p className="truncate text-[13px] font-black text-white">
          {player.firstName} {player.lastName}
        </p>
        <p className="num text-[11px] font-bold text-white/70">
          {formatNumber(player.points)} امتیاز
        </p>
        <span dir="ltr" className="w-fit rounded-lg bg-white/15 px-2 py-0.5 text-[9.5px] font-black text-white">
          {LEVEL_LABEL[player.level]}
        </span>
      </div>

      <span
        aria-hidden
        className="num pointer-events-none absolute bottom-0 left-3 text-[62px] font-black leading-[0.78] text-white/15"
      >
        {toFaDigits(player.rank)}
      </span>
    </div>
  );
}
