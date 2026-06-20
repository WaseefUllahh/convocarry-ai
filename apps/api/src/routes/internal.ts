import { FastifyInstance } from 'fastify';
import { env } from '../config/env';

export default async function (server: FastifyInstance) {
  server.post('/cleanup-tombstones', async (request, reply) => {
    // Require CRON_SECRET or admin credential
    const authHeader = request.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid cron secret' });
    }

    // Find all expired tombstones
    const expiredTombstones = await server.prisma.carryCard.findMany({
      where: {
        deletedAt: { not: null },
        purgeAfter: { lt: new Date() }
      }
    });

    if (expiredTombstones.length === 0) {
      return { success: true, purgedCount: 0 };
    }

    // For each expired tombstone, insert it into DeletedCarryCard ledger, then permanently delete heavy data
    let purgedCount = 0;

    await server.prisma.$transaction(async (tx) => {
      for (const card of expiredTombstones) {
        // Keep ledger marker for 180 days past the original deletion
        const extendedPurge = new Date(card.deletedAt!.getTime() + 180 * 24 * 60 * 60 * 1000);

        await tx.deletedCarryCard.upsert({
          where: { id: card.id },
          update: {},
          create: {
            id: card.id,
            ownerId: card.ownerId,
            teamId: card.teamFolderId, // simplistic mapping for MVP
            deletedAt: card.deletedAt!,
            purgeAfter: extendedPurge
          }
        });

        // Delete heavy data
        await tx.carryCardVersion.deleteMany({ where: { carryCardId: card.id } });
        await tx.carryCard.delete({ where: { id: card.id } });
        purgedCount++;
      }

      // Cleanup extremely old ledger entries (past 180 days)
      await tx.deletedCarryCard.deleteMany({
        where: { purgeAfter: { lt: new Date() } }
      });
    });

    return { success: true, purgedCount };
  });
}
