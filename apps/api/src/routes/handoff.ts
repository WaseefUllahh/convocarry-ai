import { FastifyInstance } from 'fastify';
import crypto from 'crypto';

export default async function (server: FastifyInstance) {
  // Utility for short code generation
  function generateShortCode(length = 8) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 1, 0
    let result = '';
    const randomArray = new Uint8Array(length);
    crypto.getRandomValues(randomArray);
    for (let i = 0; i < length; i++) {
      result += chars[randomArray[i] % chars.length];
    }
    return result;
  }

  // POST /api/v1/carry-cards/:id/share
  server.post('/carry-cards/:id/share', { preValidation: [server.requireUser] }, async (request, reply) => {
    const { id } = request.params as any;
    const { versionId, expiresInMinutes, maxClaims, targetEmail } = request.body as any;
    const userId = request.user.id;

    const card = await server.prisma.carryCard.findUnique({
      where: { id },
      include: { teamFolder: true }
    });

    if (!card) return reply.code(404).send({ error: 'Not Found', message: 'Card not found' });
    if (card.deletedAt) return reply.code(400).send({ error: 'Bad Request', message: 'Cannot share deleted card' });

    let hasAccess = false;
    if (card.teamFolderId && card.teamFolder) {
      const plan = request.user.getEffectivePlan(card.teamFolder.teamId);
      if (plan === 'TEAM') {
        const member = await server.prisma.teamMember.findUnique({
          where: { teamId_userId: { teamId: card.teamFolder.teamId, userId } }
        });
        if (member) hasAccess = true;
      }
    } else {
      const plan = request.user.getEffectivePlan();
      if (plan === 'PRO' || plan === 'TEAM') {
        if (card.ownerId === userId) hasAccess = true;
      }
    }

    if (!hasAccess) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Requires PRO or TEAM plan with appropriate access.' });
    }

    const targetVersionId = versionId || card.currentVersionId;
    if (!targetVersionId) return reply.code(400).send({ error: 'Bad Request', message: 'No version to share' });

    const version = await server.prisma.carryCardVersion.findUnique({
      where: { id: targetVersionId, carryCardId: card.id }
    });
    if (!version) return reply.code(404).send({ error: 'Not Found', message: 'Version not found' });

    const token = crypto.randomBytes(32).toString('hex');
    const shortCode = generateShortCode();
    
    let expiresAt: Date | null = null;
    if (expiresInMinutes) {
      expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);
    }

    const share = await server.prisma.carryCardShare.create({
      data: {
        carryCardVersionId: version.id,
        createdById: userId,
        token,
        shortCode,
        targetEmail: targetEmail?.toLowerCase() || null,
        expiresAt,
        maxClaims: maxClaims || null
      }
    });

    await server.prisma.usageEvent.create({
      data: {
        userId,
        eventType: 'handoff_share_created',
        metadata: { shareId: share.id, cardId: card.id }
      }
    });

    return {
      claimUrl: `${request.protocol}://${request.hostname}/claim/${token}`,
      shortCode,
      expiresAt,
      id: share.id
    };
  });

  // POST /api/v1/carry-cards/shares/:shareId/revoke
  server.post('/carry-cards/shares/:shareId/revoke', { preValidation: [server.requireUser] }, async (request, reply) => {
    const { shareId } = request.params as any;
    const userId = request.user.id;

    const share = await server.prisma.carryCardShare.findUnique({
      where: { id: shareId },
      include: { version: { include: { carryCard: true } } }
    });

    if (!share) return reply.code(404).send({ error: 'Not Found', message: 'Share not found' });
    
    // Check access
    let hasAccess = false;
    if (share.version.carryCard.teamFolderId) {
      const folder = await server.prisma.teamFolder.findUnique({ where: { id: share.version.carryCard.teamFolderId } });
      if (folder) {
        const member = await server.prisma.teamMember.findUnique({
          where: { teamId_userId: { teamId: folder.teamId, userId } }
        });
        if (member) hasAccess = true;
      }
    } else {
      if (share.version.carryCard.ownerId === userId) hasAccess = true;
    }

    if (!hasAccess && share.createdById !== userId) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Cannot revoke this share' });
    }

    await server.prisma.carryCardShare.update({
      where: { id: shareId },
      data: { revokedAt: new Date() }
    });

    return { success: true };
  });

  const rateLimits = new Map<string, { count: number, resetAt: number }>();
  
  function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimits.get(ip);
    if (!entry || entry.resetAt < now) {
      rateLimits.set(ip, { count: 1, resetAt: now + 60000 }); // 1 min window
      return true;
    }
    if (entry.count >= 10) return false; // max 10 requests per minute per IP
    entry.count++;
    return true;
  }

  // GET /api/v1/claim/:tokenOrCode (Preview)
  server.get('/claim/:tokenOrCode', { preValidation: [server.requireUser] }, async (request, reply) => {
    if (!checkRateLimit(request.ip)) {
      return reply.code(429).send({ error: 'Too Many Requests', message: 'Rate limit exceeded' });
    }

    const { tokenOrCode } = request.params as any;

    const share = await server.prisma.carryCardShare.findFirst({
      where: {
        OR: [{ token: tokenOrCode }, { shortCode: tokenOrCode }]
      },
      include: {
        version: { include: { carryCard: true } },
        createdBy: true
      }
    });

    if (!share) return reply.code(404).send({ error: 'Not Found', message: 'Invalid claim link' });
    if (share.revokedAt) return reply.code(404).send({ error: 'Not Found', message: 'Claim link revoked' });
    if (share.expiresAt && share.expiresAt < new Date()) {
      return reply.code(404).send({ error: 'Not Found', message: 'Claim link expired' });
    }
    if (share.maxClaims && share.claimCount >= share.maxClaims) {
      return reply.code(404).send({ error: 'Not Found', message: 'Claim link max capacity reached' });
    }

    return {
      title: share.version.carryCard.title,
      sourcePlatform: share.version.platform,
      createdByDisplayName: share.createdBy.displayName || share.createdBy.email,
      expiresAt: share.expiresAt,
      targetEmailRestricted: !!share.targetEmail
    };
  });

  // POST /api/v1/claim/:tokenOrCode/confirm
  server.post('/claim/:tokenOrCode/confirm', { preValidation: [server.requireUser] }, async (request, reply) => {
    const { tokenOrCode } = request.params as any;
    const { targetTeamId } = request.body as any || {}; // Optional: claim into team
    const user = request.user;

    // Check entitlement to claim
    let isClaimingToTeam = false;
    if (targetTeamId) {
      const plan = user.getEffectivePlan(targetTeamId);
      if (plan !== 'TEAM') return reply.code(403).send({ error: 'Forbidden', message: 'Requires TEAM plan' });
      isClaimingToTeam = true;
    } else {
      const plan = user.getEffectivePlan();
      // Free users can claim depending on product policy. For now we allow it.
    }

    try {
      const result = await server.prisma.$transaction(async (tx) => {
        const share = await tx.carryCardShare.findFirst({
          where: {
            OR: [{ token: tokenOrCode }, { shortCode: tokenOrCode }]
          },
          include: { version: { include: { carryCard: true } } }
        });

        if (!share) throw new Error('Invalid claim link');
        if (share.revokedAt) throw new Error('Claim link revoked');
        if (share.expiresAt && share.expiresAt < new Date()) throw new Error('Claim link expired');
        if (share.maxClaims && share.claimCount >= share.maxClaims) throw new Error('Claim link max capacity reached');
        
        if (share.targetEmail && share.targetEmail !== user.email.toLowerCase()) {
          throw new Error('Link restricted to another user');
        }

        if (share.version.carryCard.deletedAt) {
          throw new Error('Source card was deleted');
        }

        // Atomically increment
        if (share.maxClaims) {
           const updatedShare = await tx.carryCardShare.update({
             where: { id: share.id },
             data: { claimCount: { increment: 1 } }
           });
           if (updatedShare.claimCount > share.maxClaims) {
             throw new Error('Claim link max capacity reached simultaneously');
           }
        } else {
           await tx.carryCardShare.update({
             where: { id: share.id },
             data: { claimCount: { increment: 1 } }
           });
        }

        // Create isolated copy
        const newCard = await tx.carryCard.create({
          data: {
            ownerId: user.id,
            teamFolderId: null, // Note: For MVP we can just drop it in personal if targetTeamId logic isn't fully scoped with team folders
            title: `[Shared] ${share.version.carryCard.title}`,
            tags: share.version.carryCard.tags,
            originCarryCardId: share.version.carryCardId
          }
        });

        const newVersion = await tx.carryCardVersion.create({
          data: {
            carryCardId: newCard.id,
            parentId: null,
            contextBody: share.version.contextBody as any,
            rawSnapshot: share.version.rawSnapshot as any,
            sourceAccountLabel: share.version.sourceAccountLabel,
            platform: share.version.platform,
            originVersionId: share.version.id
          }
        });

        await tx.carryCard.update({
          where: { id: newCard.id },
          data: { currentVersionId: newVersion.id }
        });

        await tx.carryCardClaim.create({
          data: {
            shareId: share.id,
            claimedById: user.id,
            claimedCarryCardId: newCard.id
          }
        });

        await tx.carryCardShare.update({
          where: { id: share.id },
          data: {
            claimedAt: new Date(),
            lastClaimedById: user.id
          }
        });

        await tx.usageEvent.create({
          data: {
            userId: user.id,
            eventType: 'handoff_claim_confirmed',
            metadata: { shareId: share.id, newCardId: newCard.id }
          }
        });

        return { carryCardId: newCard.id };
      });

      return result;

    } catch (e: any) {
      return reply.code(400).send({ error: 'Bad Request', message: e.message });
    }
  });
}
