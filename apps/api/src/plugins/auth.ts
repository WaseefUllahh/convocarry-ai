import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  teams: string[];
  plan: string;
  getEffectivePlan: (teamId?: string) => string;
}

export default fp(async (server) => {
  // 1. Hook to verify the ConvoCarry Session JWT
  server.decorate('verifyToken', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
      }

      const token = authHeader.split(' ')[1];
      const decoded: any = jwt.verify(token, env.JWT_SECRET);
      
      if (!decoded || !decoded.sub) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Token missing subject' });
      }
      
      // Store raw decoded token info on the request
      (request as any).tokenPayload = {
        authProviderId: decoded.sub,
        email: decoded.email || '',
      };
    } catch (err) {
      server.log.error(err);
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid token' });
    }
  });

  // 2. Hook to require a full registered DB user (enforces tenant isolation)
  server.decorate('requireUser', async (request: FastifyRequest, reply: FastifyReply) => {
    // First ensure token is valid
    await server.verifyToken(request, reply);
    if (reply.sent) return;

    const payload = (request as any).tokenPayload;
    
    // Fetch user from DB
    const user = await server.prisma.user.findUnique({
      where: { authProviderId: payload.authProviderId },
      include: {
        teamMembers: {
          include: {
            team: {
              include: { subscription: true }
            }
          }
        },
        subscription: true
      }
    });

    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'User not registered in database. Call /auth/session first.' });
    }

    const getEffectivePlan = (targetTeamId?: string) => {
      // If no teamId provided: strictly check personal subscription
      if (!targetTeamId) {
        if (user.subscription && ['ACTIVE', 'TRIALING'].includes(user.subscription.status)) {
          return user.subscription.plan;
        }
        return 'FREE';
      }

      // If teamId provided: verify membership and check that specific team's subscription
      const member = user.teamMembers.find(tm => tm.teamId === targetTeamId);
      if (member && member.team.subscription && ['ACTIVE', 'TRIALING'].includes(member.team.subscription.status)) {
        return 'TEAM';
      }

      // Never let another team's subscription unlock this team's resources
      return 'FREE';
    };

    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      role: 'user',
      teams: user.teamMembers.map(tm => tm.teamId),
      plan: getEffectivePlan(), // base plan for legacy checks
      getEffectivePlan
    };

    request.user = authUser;
  }); // <-- closes requireUser

  // 3. Hook to require a PRO or TEAM plan globally if needed
  server.decorate('requireProOrTeam', async (request: FastifyRequest, reply: FastifyReply) => {
    await server.requireUser(request, reply);
    if (reply.sent) return;

    // Check personal plan
    if (request.user.plan === 'PRO' || request.user.plan === 'TEAM') return;

    // Check if they have ANY active team plan to allow them into mixed endpoints
    // For specific endpoints, they must still use getEffectivePlan(teamId)
    const user = await server.prisma.user.findUnique({
      where: { id: request.user.id },
      include: {
        teamMembers: {
          include: { team: { include: { subscription: true } } }
        }
      }
    });

    const hasAnyTeamPlan = user?.teamMembers.some(tm => 
      tm.team.subscription && ['ACTIVE', 'TRIALING'].includes(tm.team.subscription.status)
    );

    if (!hasAnyTeamPlan) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Cloud sync requires a Pro or Team subscription.' });
    }
  });

  // 4. Hook to require a valid MCP API key
  server.decorate('requireApiKey', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Missing API Key' });
    }

    const rawKey = authHeader.substring(7).trim();
    if (!rawKey.startsWith('cc_live_')) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid API Key format' });
    }

    const secretPart = rawKey.substring('cc_live_'.length);
    const crypto = await import('crypto');
    const hashedKey = crypto.createHash('sha256').update(secretPart).digest('hex');

    const apiKey = await server.prisma.apiKey.findUnique({
      where: { hashedKey },
      include: { user: { include: { subscription: true, teamMembers: { include: { team: { include: { subscription: true } } } } } } }
    });

    if (!apiKey) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid API Key' });
    }

    if (apiKey.revokedAt) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'API Key revoked' });
    }

    // Attach user
    const dbUser = apiKey.user;
    const getEffectivePlan = (targetTeamId?: string) => {
      if (!targetTeamId) {
        if (dbUser.subscription && ['ACTIVE', 'TRIALING'].includes(dbUser.subscription.status)) {
          return dbUser.subscription.plan;
        }
        return 'FREE';
      }
      const member = dbUser.teamMembers.find(tm => tm.teamId === targetTeamId);
      if (member && member.team.subscription && ['ACTIVE', 'TRIALING'].includes(member.team.subscription.status)) {
        return 'TEAM';
      }
      return 'FREE';
    };

    const authUser: AuthenticatedUser = {
      id: dbUser.id,
      email: dbUser.email,
      role: 'user',
      teams: dbUser.teamMembers.map(tm => tm.teamId),
      plan: getEffectivePlan(), 
      getEffectivePlan
    };

    request.user = authUser;

    // Update lastUsedAt
    await server.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() }
    });

    request.apiKey = {
      id: apiKey.id,
      teamId: apiKey.teamId,
      scopes: apiKey.scopes
    };
  });
});
// NOTE: Fastify module augmentation (declare module 'fastify') has been moved to
// src/types/fastify.d.ts — esbuild cannot parse it in a runtime .ts file.
