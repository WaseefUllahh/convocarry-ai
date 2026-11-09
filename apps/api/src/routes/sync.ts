import { FastifyInstance } from 'fastify';
import { canAccessCloudCard, versionBelongsToCard } from '../services/card-access';

export default async function (server: FastifyInstance) {
  // POST /sync/push
  server.post('/push', { preValidation: [server.requireProOrTeam] }, async (request, reply) => {
    const { cards = [], versions = [] } = request.body as any;
    const userId = request.user.id;
    
    if (cards.length + versions.length > 50) {
      return reply.code(400).send({ error: 'Bad Request', message: 'Payload exceeds batch limit of 50 items' });
    }

    const results = { cardsUpdated: 0, versionsAdded: 0, errors: [] as string[] };

    // 1. Process Cards (Last-write-wins & Tombstones)
    for (const clientCard of cards) {
      try {
        const deletedLedgerEntry = await server.prisma.deletedCarryCard.findUnique({ where: { id: clientCard.id } });
        if (deletedLedgerEntry && !clientCard.deletedAt) {
          return reply.code(410).send({
            errorCode: 'CARD_PURGED',
            message: 'This Carry Card was deleted and can no longer be restored.',
            cardId: clientCard.id
          });
        }

        const existing = await server.prisma.carryCard.findUnique({ where: { id: clientCard.id } });
        if (existing) {
          let hasAccess = false;
        
          if (existing.teamFolderId) {
            const folder = await server.prisma.teamFolder.findUnique({ where: { id: existing.teamFolderId } });
            if (folder) {
              const effectivePlan = request.user.getEffectivePlan(folder.teamId);
              if (effectivePlan === 'TEAM') {
                const member = await server.prisma.teamMember.findUnique({ where: { teamId_userId: { teamId: folder.teamId, userId } } });
                if (member) hasAccess = true;
              }
            }
          } else {
            const effectivePlan = request.user.getEffectivePlan();
            if (effectivePlan === 'PRO' || effectivePlan === 'TEAM') {
              hasAccess = existing.ownerId === userId;
            }
          }

          if (!hasAccess) {
            results.errors.push(`Card ${clientCard.id}: Forbidden`);
            continue;
          }
          
          const clientTime = new Date(clientCard.updatedAt).getTime();
          const serverTime = existing.updatedAt.getTime();
          
          if (clientTime > serverTime) {
            await server.prisma.carryCard.update({
              where: { id: clientCard.id },
              data: {
                title: clientCard.title,
                description: clientCard.description,
                tags: clientCard.tags,
                currentVersionId: clientCard.currentVersionId,
                deletedAt: clientCard.deletedAt ? new Date(clientCard.deletedAt) : null,
                purgeAfter: clientCard.purgeAfter ? new Date(clientCard.purgeAfter) : null,
                updatedAt: new Date() // Force server timestamp
              }
            });
            results.cardsUpdated++;
          }
        } else {
          // Do not allow resurrecting a card that was hard-deleted or doesn't exist, unless it's a genuine new creation
          if (clientCard.deletedAt) continue;

          await server.prisma.carryCard.create({
            data: {
              id: clientCard.id,
              ownerId: userId,
              title: clientCard.title,
              description: clientCard.description,
              tags: clientCard.tags || [],
              currentVersionId: clientCard.currentVersionId,
            }
          });
          results.cardsUpdated++;
        }
      } catch (err: any) {
        results.errors.push(`Card ${clientCard.id}: ${err.message}`);
      }
    }

    // 2. Process Versions (Append-only, Idempotent)
    for (const clientVersion of versions) {
      try {
        const targetCard = await server.prisma.carryCard.findUnique({
          where: { id: clientVersion.carryCardId },
          include: { teamFolder: true }
        });
        if (!targetCard || !canAccessCloudCard(request.user, targetCard)) {
          results.errors.push(`Version ${clientVersion.id}: Forbidden`);
          continue;
        }

        if (clientVersion.parentId) {
          const parent = await server.prisma.carryCardVersion.findUnique({ where: { id: clientVersion.parentId } });
          if (!versionBelongsToCard(parent, targetCard.id)) {
            results.errors.push(`Version ${clientVersion.id}: Parent version belongs to another card`);
            continue;
          }
        }

        const existing = await server.prisma.carryCardVersion.findUnique({ where: { id: clientVersion.id } });
        if (existing && !versionBelongsToCard(existing, targetCard.id)) {
          results.errors.push(`Version ${clientVersion.id}: ID collision`);
          continue;
        }
        if (!existing) {
          await server.prisma.carryCardVersion.create({
            data: {
              id: clientVersion.id,
              carryCardId: clientVersion.carryCardId,
              parentId: clientVersion.parentId,
              platform: clientVersion.platform,
              contextBody: clientVersion.contextBody,
              rawSnapshot: clientVersion.rawSnapshot,
              sourceAccountLabel: clientVersion.sourceAccountLabel,
              originVersionId: clientVersion.originVersionId
            }
          });
          results.versionsAdded++;
        }
        // If it exists, we strictly ignore it (append-only)
      } catch (err: any) {
        results.errors.push(`Version ${clientVersion.id}: ${err.message}`);
      }
    }

    return results;
  });

  // POST /sync/pull
  server.post('/pull', { preValidation: [server.requireProOrTeam] }, async (request, reply) => {
    const { lastSyncTimestamp, limit = 50, cursor } = request.body as any;
    const userId = request.user.id;
    
    const since = lastSyncTimestamp ? new Date(lastSyncTimestamp) : new Date(0);

    const effectivePlan = request.user.getEffectivePlan();
    const canPullPersonal = effectivePlan === 'PRO' || effectivePlan === 'TEAM';
    
    const activeTeamIds: string[] = [];
    for (const teamId of request.user.teams) {
       if (request.user.getEffectivePlan(teamId) === 'TEAM') {
          activeTeamIds.push(teamId);
       }
    }

    if (!canPullPersonal && activeTeamIds.length === 0) {
      return { cards: [], versions: [], nextCursor: null, hasMore: false };
    }

    const orConditions: any[] = [];
    if (canPullPersonal) {
      // Pull personal cards (not assigned to a team folder)
      orConditions.push({ ownerId: userId, teamFolderId: null });
    }
    if (activeTeamIds.length > 0) {
      // Pull team cards for teams where they have active entitlement
      orConditions.push({
        teamFolder: {
          teamId: { in: activeTeamIds }
        }
      });
    }

    const cards = await server.prisma.carryCard.findMany({
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      where: {
        OR: orConditions,
        updatedAt: { gt: since }
      },
      orderBy: { id: 'asc' }
    });

    const cardIds = cards.map(c => c.id);
    let versions: any[] = [];
    
    if (cardIds.length > 0) {
      versions = await server.prisma.carryCardVersion.findMany({
        where: {
          carryCardId: { in: cardIds },
          createdAt: { gt: since }
        }
      });
    }

    const nextCursor = cards.length === limit ? cards[cards.length - 1].id : null;

    return {
      timestamp: new Date().toISOString(),
      data: { cards, versions },
      nextCursor,
      hasMore: nextCursor !== null
    };
  });
}
