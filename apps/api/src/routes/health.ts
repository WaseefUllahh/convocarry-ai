import { FastifyInstance } from 'fastify';

export default async function (server: FastifyInstance) {
  server.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Protected route example to test requireUser middleware
  server.get('/protected', { preValidation: [server.requireUser] }, async (request) => {
    return {
      message: 'You have access to protected data',
      user: request.user
    };
  });
}
