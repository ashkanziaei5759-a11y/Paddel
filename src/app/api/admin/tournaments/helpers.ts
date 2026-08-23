import type { z } from 'zod';
import type { tournamentSchema } from '@/lib/validation';

type Input = z.infer<typeof tournamentSchema>;

/** فیلدهای مشترک بین ایجاد و ویرایش تورنومنت */
export function buildTournamentData(input: Input) {
  return {
    name: input.name,
    description: input.description ?? null,
    coverUrl: input.coverUrl ?? null,
    type: input.type,
    status: input.status ?? 'DRAFT',
    startsAt: new Date(input.startsAt),
    endsAt: new Date(input.endsAt),
    registrationOpensAt: input.registrationOpensAt ? new Date(input.registrationOpensAt) : null,
    registrationClosesAt: input.registrationClosesAt ? new Date(input.registrationClosesAt) : null,
    maxTeams: input.maxTeams,
    minTeams: input.minTeams,
    splitFeeBetweenPartners: input.splitFeeBetweenPartners,
    partnerMode: input.partnerMode,
    groupCount: input.groupCount ?? null,
    advancingPerGroup: input.advancingPerGroup ?? null,
    hasThirdPlaceMatch: input.hasThirdPlaceMatch,
    doubleRoundRobin: input.doubleRoundRobin,
    pointsForWin: input.pointsForWin,
    pointsForDraw: input.pointsForDraw,
    pointsForLoss: input.pointsForLoss,
  };
}
