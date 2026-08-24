import type { PlayerLevel } from '@prisma/client';
import { Avatar } from '@/components/ui/Avatar';
import { LEVEL_LABEL } from '@/lib/constants';
import { cn } from '@/lib/utils';

export interface TeamMemberDto {
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  level: PlayerLevel | null;
  isLeader: boolean;
}

export interface TeamCardDto {
  id: string;
  name: string;
  members: TeamMemberDto[];
  rank?: number | null;
  points?: number | null;
}

/**
 * کارت تیم: عکس پروفایل هر دو هم‌تیمی به‌صورت دایره‌های کنار هم (با هم‌پوشانی)
 * و نام کاملشان زیر آن.
 */
export function TeamCard({
  team,
  highlight,
  rankLabel,
}: {
  team: TeamCardDto;
  highlight?: boolean;
  rankLabel?: string;
}) {
  return (
    <div className={cn('card p-4', highlight && 'ring-1 ring-accent/40')}>
      <div className="flex items-center gap-3">
        {/* دایره‌های عکس پروفایل، کنار هم و با هم‌پوشانی */}
        <div className="flex shrink-0 items-center">
          {team.members.map((m, i) => (
            <div
              key={m.userId}
              className="relative"
              style={{ marginInlineStart: i > 0 ? '-0.875rem' : 0, zIndex: team.members.length - i }}
            >
              <Avatar
                firstName={m.firstName}
                lastName={m.lastName}
                src={m.avatarUrl}
                size="md"
                className="ring-2 ring-white"
              />
              {m.level && (
                /* نشان سطح روی لبه‌ی بیرونی هر دایره می‌نشیند تا زیر دایره‌ی کناری پنهان نشود.
                   dir=ltr لازم است وگرنه «A−» به شکل «−A» دیده می‌شود. */
                <span
                  dir="ltr"
                  className={cn(
                    'absolute -bottom-1 flex h-5 min-w-5 items-center justify-center rounded-lg bg-brand-800 px-1 text-[9px] font-black text-white ring-2 ring-white',
                    i === 0 ? '-right-1' : '-left-1',
                  )}
                >
                  {LEVEL_LABEL[m.level]}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-extrabold text-brand-800">
            {team.members.map((m) => `${m.firstName} ${m.lastName}`).join(' و ')}
          </p>
          <p className="mt-1 truncate text-[10px] font-semibold text-brand-400">تیم {team.name}</p>
        </div>

        {rankLabel && <span className="badge-accent shrink-0">{rankLabel}</span>}
        {team.points != null && team.points > 0 && !rankLabel && (
          <span className="badge-brand num shrink-0">{team.points} امتیاز</span>
        )}
      </div>
    </div>
  );
}
