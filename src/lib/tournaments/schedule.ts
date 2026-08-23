import 'server-only';
import type { MatchStage, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/api';

export interface Pairing {
  teamAId: string | null;
  teamBId: string | null;
  round: number;
  slotInRound: number;
}

/**
 * زمان‌بندی دوره‌ای (Round-Robin) با الگوریتم چرخشی «Circle».
 * در صورت فرد بودن تعداد تیم‌ها، یک تیم مجازی (استراحت) اضافه می‌شود.
 */
export function roundRobin(teamIds: string[], doubleRound = false): Pairing[] {
  const teams = [...teamIds];
  const BYE = '__BYE__';
  if (teams.length % 2 === 1) teams.push(BYE);

  const n = teams.length;
  const rounds = n - 1;
  const half = n / 2;
  const pairings: Pairing[] = [];

  let rotation = teams.slice();

  for (let r = 0; r < rounds; r += 1) {
    let slot = 0;
    for (let i = 0; i < half; i += 1) {
      const a = rotation[i];
      const b = rotation[n - 1 - i];
      if (a === BYE || b === BYE) continue;
      // جابه‌جایی میزبانی برای توازن
      const [teamAId, teamBId] = r % 2 === 0 ? [a, b] : [b, a];
      pairings.push({ teamAId, teamBId, round: r + 1, slotInRound: slot });
      slot += 1;
    }
    // چرخش: عنصر اول ثابت می‌ماند
    rotation = [rotation[0], rotation[n - 1], ...rotation.slice(1, n - 1)];
  }

  if (!doubleRound) return pairings;

  const second = pairings.map((p) => ({
    teamAId: p.teamBId,
    teamBId: p.teamAId,
    round: p.round + rounds,
    slotInRound: p.slotInRound,
  }));

  return [...pairings, ...second];
}

/** تقسیم تیم‌ها بین گروه‌ها به‌صورت مارپیچ (Snake) تا توازن حفظ شود */
export function distributeToGroups(teamIds: string[], groupCount: number): string[][] {
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  teamIds.forEach((id, index) => {
    const row = Math.floor(index / groupCount);
    const col = index % groupCount;
    const target = row % 2 === 0 ? col : groupCount - 1 - col;
    groups[target].push(id);
  });
  return groups;
}

/** بزرگ‌ترین توان ۲ که کوچک‌تر یا مساوی n باشد */
export function bracketSize(teamCount: number): number {
  let size = 1;
  while (size * 2 <= teamCount) size *= 2;
  return Math.max(2, size);
}

export function stageForBracketSize(size: number): MatchStage {
  switch (size) {
    case 2:
      return 'FINAL';
    case 4:
      return 'SEMI_FINAL';
    case 8:
      return 'QUARTER_FINAL';
    case 16:
      return 'ROUND_OF_16';
    default:
      return 'ROUND_OF_32';
  }
}

/** ترتیب استاندارد سیدبندی براکت: ۱ مقابل آخر، ۲ مقابل یکی‌مانده‌به‌آخر و ... */
export function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const next: number[] = [];
    const total = order.length * 2 + 1;
    for (const seed of order) {
      next.push(seed, total - seed);
    }
    order = next;
  }
  return order;
}

/**
 * ساخت کامل جدول مسابقات یک تورنومنت.
 * برای لیگ: یک دور کامل (یا رفت و برگشت).
 * برای گروهی+حذفی: مسابقات گروهی + اسکلت براکت حذفی که با پایان گروه‌ها پر می‌شود.
 */
export async function generateSchedule(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      teams: { where: { isActive: true }, orderBy: [{ seed: 'asc' }, { createdAt: 'asc' }] },
      groups: true,
    },
  });

  if (!tournament) throw new AppError('تورنومنت یافت نشد.', 404);

  const teams = tournament.teams;
  if (teams.length < 2) throw new AppError('برای ساخت جدول حداقل ۲ تیم لازم است.');

  await prisma.$transaction(async (tx) => {
    await tx.tournamentMatch.deleteMany({ where: { tournamentId } });
    await tx.tournamentStanding.deleteMany({ where: { tournamentId } });

    if (tournament.type === 'LEAGUE') {
      const pairings = roundRobin(teams.map((t) => t.id), tournament.doubleRoundRobin);
      await tx.tournamentMatch.createMany({
        data: pairings.map((p) => ({
          tournamentId,
          stage: 'LEAGUE' as MatchStage,
          round: p.round,
          slotInRound: p.slotInRound,
          teamAId: p.teamAId,
          teamBId: p.teamBId,
        })),
      });
      await tx.tournamentStanding.createMany({
        data: teams.map((t) => ({ tournamentId, teamId: t.id })),
      });
      return;
    }

    // ---- مرحله گروهی + حذفی ----
    const groupCount = Math.max(1, tournament.groupCount ?? Math.ceil(teams.length / 4));
    await tx.tournamentGroup.deleteMany({ where: { tournamentId } });

    const groupRecords = [];
    for (let i = 0; i < groupCount; i += 1) {
      groupRecords.push(
        await tx.tournamentGroup.create({
          data: { tournamentId, name: `گروه ${String.fromCharCode(65 + i)}`, order: i },
        }),
      );
    }

    const distribution = distributeToGroups(teams.map((t) => t.id), groupCount);

    for (let gi = 0; gi < distribution.length; gi += 1) {
      const group = groupRecords[gi];
      const memberIds = distribution[gi];

      await tx.tournamentTeam.updateMany({
        where: { id: { in: memberIds } },
        data: { groupId: group.id },
      });

      await tx.tournamentStanding.createMany({
        data: memberIds.map((teamId) => ({ tournamentId, teamId, groupId: group.id })),
      });

      if (memberIds.length < 2) continue;

      const pairings = roundRobin(memberIds, tournament.doubleRoundRobin);
      await tx.tournamentMatch.createMany({
        data: pairings.map((p) => ({
          tournamentId,
          groupId: group.id,
          stage: 'GROUP' as MatchStage,
          round: p.round,
          slotInRound: p.slotInRound,
          teamAId: p.teamAId,
          teamBId: p.teamBId,
        })),
      });
    }

    // اسکلت براکت حذفی
    const advancing = (tournament.advancingPerGroup ?? 2) * groupCount;
    const size = bracketSize(advancing);
    await createBracketSkeleton(tx, tournamentId, size, tournament.hasThirdPlaceMatch);
  }, { timeout: 30_000 });

  return prisma.tournamentMatch.count({ where: { tournamentId } });
}

/** ایجاد ساختار خالی براکت و اتصال هر مسابقه به مسابقه‌ی بعدی */
export async function createBracketSkeleton(
  tx: Prisma.TransactionClient,
  tournamentId: string,
  size: number,
  withThirdPlace: boolean,
) {
  const rounds: { stage: MatchStage; count: number }[] = [];
  let current = size;
  while (current >= 2) {
    rounds.push({ stage: stageForBracketSize(current), count: current / 2 });
    current /= 2;
  }

  // از فینال به عقب می‌سازیم تا nextMatchId در دسترس باشد
  let nextRoundIds: string[] = [];

  for (let r = rounds.length - 1; r >= 0; r -= 1) {
    const { stage, count } = rounds[r];
    const createdIds: string[] = [];

    for (let i = 0; i < count; i += 1) {
      const nextMatchId = nextRoundIds.length ? nextRoundIds[Math.floor(i / 2)] : null;
      const match = await tx.tournamentMatch.create({
        data: {
          tournamentId,
          stage,
          round: r + 1,
          slotInRound: i,
          nextMatchId,
          nextMatchSlot: nextMatchId ? (i % 2 === 0 ? 1 : 2) : null,
        },
      });
      createdIds.push(match.id);
    }
    nextRoundIds = createdIds;
  }

  if (withThirdPlace && size >= 4) {
    await tx.tournamentMatch.create({
      data: { tournamentId, stage: 'THIRD_PLACE', round: rounds.length, slotInRound: 1 },
    });
  }
}
