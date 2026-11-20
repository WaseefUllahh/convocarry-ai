import { FastifyInstance } from 'fastify';
import { versionBelongsToCard } from '../services/card-access';

export default async function (server: FastifyInstance) {
  // GET /carry-cards
  server.get('/', { preValidation: [server.requireUser] }, async (request, reply) => {
    return server.prisma.carryCard.findMany({
      where: { ownerId: request.user.id }
    });
  });

  // POST /carry-cards
  server.post('/', { preValidation: [server.requireProOrTeam] }, async (request, reply) => {
    const { title, description, tags, teamFolderId, platform, contextBody, sourceAccountLabel } = request.body as any;

    if (teamFolderId) {
      const folder = await server.prisma.teamFolder.findUnique({ where: { id: teamFolderId } });
      if (!folder || !request.user.teams.includes(folder.teamId) || request.user.getEffectivePlan(folder.teamId) !== 'TEAM') {
        return reply.code(403).send({ error: 'Forbidden', message: 'Team folder access denied' });
      }
    }

    // Single transaction to create card and initial version
    const card = await server.prisma.carryCard.create({
      data: {
        ownerId: request.user.id,
        title,
        description,
        tags: tags || [],
        teamFolderId,
        versions: {
          create: {
            platform,
            contextBody,
            sourceAccountLabel
          }
        }
      },
      include: { versions: true }
    });

    // Update currentVersionId
    await server.prisma.carryCard.update({
      where: { id: card.id },
      data: { currentVersionId: card.versions[0].id }
    });

    return server.prisma.carryCard.findUnique({ where: { id: card.id }, include: { versions: true } });
  });

  // GET /carry-cards/:id
  server.get('/:id', { preValidation: [server.requireUser] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const card = await server.prisma.carryCard.findUnique({ where: { id }, include: { versions: true } });
    if (!card) return reply.code(404).send({ error: 'Not Found', message: 'Card not found' });
    if (card.ownerId !== request.user.id) return reply.code(403).send({ error: 'Forbidden', message: 'You do not have access to this card' });
    return card;
  });

  // PATCH /carry-cards/:id
  server.patch('/:id', { preValidation: [server.requireProOrTeam] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { title, description, tags, currentVersionId } = request.body as any;
    
    const existing = await server.prisma.carryCard.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== request.user.id) return reply.code(403).send({ error: 'Forbidden' });

    if (currentVersionId != null) {
      const version = await server.prisma.carryCardVersion.findUnique({ where: { id: currentVersionId } });
      if (!versionBelongsToCard(version, id)) {
        return reply.code(400).send({ error: 'Bad Request', message: 'Version does not belong to this card' });
      }
    }

    return server.prisma.carryCard.update({
      where: { id },
      data: { title, description, tags, currentVersionId }
    });
  });

  // DELETE /carry-cards/:id
  server.delete('/:id', { preValidation: [server.requireProOrTeam] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await server.prisma.carryCard.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== request.user.id) return reply.code(403).send({ error: 'Forbidden' });
    
    await server.prisma.carryCard.delete({ where: { id } });
    return { success: true };
  });

  // POST /carry-cards/:id/versions
  server.post('/:id/versions', { preValidation: [server.requireProOrTeam] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { platform, contextBody, sourceAccountLabel, rawSnapshot, parentId, originVersionId } = request.body as any;

    const existing = await server.prisma.carryCard.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== request.user.id) return reply.code(403).send({ error: 'Forbidden' });

    if (parentId) {
      const parent = await server.prisma.carryCardVersion.findUnique({ where: { id: parentId } });
      if (!versionBelongsToCard(parent, id)) {
        return reply.code(400).send({ error: 'Bad Request', message: 'Parent version does not belong to this card' });
      }
    }

    const version = await server.prisma.carryCardVersion.create({
      data: {
        carryCardId: id,
        parentId,
        platform,
        contextBody,
        rawSnapshot,
        sourceAccountLabel,
        originVersionId
      }
    });

    await server.prisma.carryCard.update({
      where: { id },
      data: { currentVersionId: version.id }
    });

    return version;
  });

  // POST /carry-cards/:id/versions/:versionId/rollback
  server.post('/:id/versions/:versionId/rollback', { preValidation: [server.requireProOrTeam] }, async (request, reply) => {
    const { id, versionId } = request.params as { id: string, versionId: string };
    
    const existing = await server.prisma.carryCard.findUnique({ where: { id } });
    if (!existing || existing.ownerId !== request.user.id) return reply.code(403).send({ error: 'Forbidden' });

    const version = await server.prisma.carryCardVersion.findUnique({ where: { id: versionId } });
    if (!versionBelongsToCard(version, id)) {
      return reply.code(404).send({ error: 'Not Found', message: 'Version not found on this card' });
    }

    await server.prisma.carryCard.update({
      where: { id },
      data: { currentVersionId: versionId }
    });

    return { success: true };
  });

  // POST /carry-cards/:id/versions/:versionId/branch
  server.post('/:id/versions/:versionId/branch', { preValidation: [server.requireProOrTeam] }, async (request, reply) => {
    const { id, versionId } = request.params as { id: string, versionId: string };
    const { newTitle } = request.body as any;

    const sourceVersion = await server.prisma.carryCardVersion.findUnique({ where: { id: versionId } });
    if (!sourceVersion || sourceVersion.carryCardId !== id) return reply.code(404).send({ error: 'Not Found' });

    const sourceCard = await server.prisma.carryCard.findUnique({ where: { id } });
    if (!sourceCard || sourceCard.ownerId !== request.user.id) return reply.code(403).send({ error: 'Forbidden' });

    // Branch logic creates a new Card
    const newCard = await server.prisma.carryCard.create({
      data: {
        ownerId: request.user.id,
        title: newTitle || `${sourceCard.title} (Branch)`,
        originCarryCardId: id,
        versions: {
          create: {
            platform: sourceVersion.platform,
            contextBody: sourceVersion.contextBody || [],
            rawSnapshot: sourceVersion.rawSnapshot || [],
            sourceAccountLabel: sourceVersion.sourceAccountLabel,
            originVersionId: versionId
          }
        }
      },
      include: { versions: true }
    });

    await server.prisma.carryCard.update({
      where: { id: newCard.id },
      data: { currentVersionId: newCard.versions[0].id }
    });

    return newCard;
  });
}
