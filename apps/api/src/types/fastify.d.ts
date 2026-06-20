import 'fastify';
import type { AuthenticatedUser } from '../plugins/auth';

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthenticatedUser;
    apiKey?: { id: string; teamId?: string | null; scopes: string[] };
    tokenPayload?: { authProviderId: string; email: string };
  }
  interface FastifyInstance {
    verifyToken: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireUser: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireProOrTeam: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireApiKey: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
