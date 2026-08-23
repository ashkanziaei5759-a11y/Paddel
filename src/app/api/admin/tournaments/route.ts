import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth/rbac';
import { handleApiError, ok } from '@/lib/api';
import { tournamentSchema } from '@/lib/validation';
import { slugify, tomanToRial } from '@/lib/utils';
import { buildTournamentData } from './helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    const tournaments = await prisma.tournament.findMany({
      orderBy: { startsAt: 'desc' },
      include: { _count: { select: { teams: true } } },
    });
    return ok({ tournaments });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const input = tournamentSchema.parse(body);

    let slug = slugify(input.name);
    if (await prisma.tournament.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }

    const tournament = await prisma.$transaction(async (tx) => {
      const created = await tx.tournament.create({
        data: {
          ...buildTournamentData(input),
          slug,
          entryFee: tomanToRial(input.entryFeeToman),
          createdById: admin.id,
        },
      });

      if (input.courtIds.length) {
        await tx.tournamentCourt.createMany({
          data: input.courtIds.map((courtId) => ({ tournamentId: created.id, courtId })),
        });
      }

      if (input.levelRule) {
        await tx.tournamentLevelRule.create({
          data: {
            tournamentId: created.id,
            type: input.levelRule.type,
            slot1Levels: input.levelRule.slot1Levels,
            slot2Levels: input.levelRule.slot2Levels,
            combinations: input.levelRule.combinations,
            orderInsensitive: input.levelRule.orderInsensitive,
            description: input.levelRule.description ?? null,
          },
        });
      }

      if (input.pointsRules.length) {
        await tx.tournamentPointsRule.createMany({
          data: input.pointsRules.map((r) => ({
            tournamentId: created.id,
            rank: r.rank,
            pointsPerPlayer: r.pointsPerPlayer,
            label: r.label ?? null,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    return ok({ id: tournament.id, slug: tournament.slug }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
