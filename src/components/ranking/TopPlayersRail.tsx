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
  /** عکسِ پس‌زمینه‌حذف‌شده — شناور نشان داده می‌شود */
  avatarHasAlpha?: boolean;
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
    <div className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 pt-11">
      {players.map((player) => (
        <PlayerCard key={player.userId} player={player} />
      ))}
    </div>
  );
}

function PlayerCard({ player }: { player: TopPlayer }) {
  const women = player.gender === 'FEMALE';

  return (
    <div className="relative h-[112px] w-[268px] shrink-0 snap-start">
      {/* لایه‌ی رنگی جداست تا گوشه‌ها گرد بماند و عکس بتواند از کارت بیرون بزند */}
      <div
        className={cn(
          'absolute inset-0 overflow-hidden rounded-3xl',
          women
            ? 'bg-[linear-gradient(135deg,#3B1461_0%,#5B21A6_55%,#7C3AED_100%)]'
            : 'bg-[linear-gradient(135deg,#0A2A4A_0%,#0047A3_55%,#007FFF_100%)]',
        )}
      >
        <span className="absolute inset-0 bg-court-lines opacity-30" />
      </div>

      {/* شماره‌ی رتبه — بزرگ و خوانا، نه یک بافت کم‌رنگ */}
      <span
        aria-hidden
        className="num pointer-events-none absolute bottom-1 left-4 text-[58px] font-black leading-[0.74] text-white/85"
        style={{ textShadow: '0 2px 12px rgba(0,0,0,.45)' }}
      >
        {toFaDigits(player.rank)}
      </span>

      {/* عکس بازیکن. فقط تصویرِ پس‌زمینه‌حذف‌شده اجازه دارد از کارت بیرون بزند؛
          عکس معمولی داخل یک قاب گرد می‌ماند تا مستطیلش روی متن نیفتد. */}
      {player.avatarUrl && player.avatarHasAlpha ? (
        <div className="pointer-events-none absolute -top-10 right-1 h-[152px] w-[112px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={player.avatarUrl}
            alt=""
            className="h-full w-full object-contain object-bottom drop-shadow-[0_12px_18px_rgba(0,0,0,.5)]"
          />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-y-3 right-3 w-[76px] overflow-hidden rounded-2xl ring-1 ring-white/20">
          {player.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={player.avatarUrl} alt="" className="h-full w-full object-cover object-top" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-white/10">
              <Avatar
                firstName={player.firstName}
                lastName={player.lastName}
                size="md"
                className="ring-2 ring-white/25"
              />
            </div>
          )}
        </div>
      )}

      {/* عکس روی لبه‌ی راست کارت است و در چیدمان راست‌به‌چپ، «راست» یعنی
          inline-start؛ پس فاصله‌ی بزرگ‌تر باید ps باشد نه pe. جای شماره‌ی
          رتبه — لبه‌ی چپ — با pe باز می‌شود. */}
      <div className="relative flex h-full flex-col justify-center gap-1 pe-[68px] ps-[104px]">
        <p className="truncate text-[13.5px] font-black leading-snug text-white">
          {player.firstName} {player.lastName}
        </p>
        <p className="num text-[11.5px] font-bold text-white/75">
          {formatNumber(player.points)} امتیاز
        </p>
        <span
          dir="ltr"
          className="w-fit rounded-lg bg-white/20 px-2 py-0.5 text-[9.5px] font-black text-white"
        >
          {LEVEL_LABEL[player.level]}
        </span>
      </div>
    </div>
  );
}
