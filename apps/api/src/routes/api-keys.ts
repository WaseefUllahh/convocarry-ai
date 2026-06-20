import { FastifyInstance } from 'fastify';
import crypto from 'crypto';

export default async function (server: FastifyInstance) {
  function hashKey(key: string) {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  // POST /api/v1/api-keys
  server.post('/api-keys', { preValidation: [server.requireUser] }, async (request, reply) => {
    const { label, teamId, scopes } = request.body as any;
    const userId = request.user.id;

    // Check Entitlement
    let plan = 'FREE';
    if (teamId) {
      plan = request.user.getEffectivePlan(teamId);
      if (plan !== 'TEAM') {
        return reply.code(403).send({ error: 'Forbidden', message: 'Team scoped keys require TEAM plan' });
      }
      const member = await server.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } }
      });
      if (!member) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Not a member of this team' });
      }
    } else {
      plan = request.user.getEffectivePlan();
      if (plan === 'FREE') {
        return reply.code(403).send({ error: 'Forbidden', message: 'MCP access requires PRO or TEAM plan' });
      }
    }

    const rawSecret = crypto.randomBytes(32).toString('hex');
    const rawKey = `cc_live_${rawSecret}`;
    const hashedKey = hashKey(rawSecret); // only hash the secret part

    const apiKey = await server.prisma.apiKey.create({
      data: {
        userId,
        teamId: teamId || null,
        label,
        hashedKey,
        scopes: scopes || ['mcp:read', 'mcp:write']
      }
    });

    return {
      id: apiKey.id,
      rawKey, // Returned ONCE
      label: apiKey.label,
      teamId: apiKey.teamId,
      scopes: apiKey.scopes,
      createdAt: apiKey.createdAt
    };
  });

  // GET /api/v1/api-keys
  server.get('/api-keys', { preValidation: [server.requireUser] }, async (request, reply) => {
    const userId = request.user.id;
    
    const keys = await server.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        label: true,
        teamId: true,
        scopes: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true
      }
    });

    return keys;
  });

  // DELETE /api/v1/api-keys/:id
  server.delete('/api-keys/:id', { preValidation: [server.requireUser] }, async (request, reply) => {
    const { id } = request.params as any;
    const userId = request.user.id;

    const key = await server.prisma.apiKey.findUnique({ where: { id } });
    if (!key || key.userId !== userId) {
      return reply.code(404).send({ error: 'Not Found', message: 'API Key not found' });
    }

    await server.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() }
    });

    return { success: true };
  });
}
