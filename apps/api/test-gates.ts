import fastify from 'fastify';
import syncRoutes from './src/routes/sync';
import handoffRoutes from './src/routes/handoff';
import apiKeysRoutes from './src/routes/api-keys';

async function runGatesTest() {
  const app = fastify();

  // Mock requireUser to inject a FREE user properly bypassing network Supabase validation,
  // but preserving the request.user object interface required by the API.
  app.decorate('requireUser', async (request: any) => {
    request.user = { 
      id: 'mock-free-user-id',
      email: 'free@example.com',
      getEffectivePlan: () => 'FREE' // This is what the paid middleware checks
    };
  });

  // Mock server.requireProOrTeam
  app.decorate('requireProOrTeam', async (request: any, reply: any) => {
    if (request.user.getEffectivePlan() === 'FREE') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Requires PRO or TEAM plan.' });
    }
  });

  app.register(syncRoutes, { prefix: '/api/v1/sync' });
  app.register(handoffRoutes, { prefix: '/api/v1/carry-cards' });
  app.register(apiKeysRoutes, { prefix: '/api/v1/api-keys' });

  await app.ready();

  console.log('\n--- GATE TEST 1: Sync Push ---');
  const res1 = await app.inject({ method: 'POST', url: '/api/v1/sync/push' });
  console.log(`Status: ${res1.statusCode} | Body: ${res1.body}`);

  console.log('\n--- GATE TEST 2: Account Handoff Link ---');
  const res2 = await app.inject({ method: 'POST', url: '/api/v1/carry-cards/card-id/share' });
  console.log(`Status: ${res2.statusCode} | Body: ${res2.body}`);

  console.log('\n--- GATE TEST 3: MCP API Key ---');
  const res3 = await app.inject({ method: 'POST', url: '/api/v1/api-keys' });
  console.log(`Status: ${res3.statusCode} | Body: ${res3.body}`);

  console.log('\n--- GATE TEST 4: Team-scoped MCP Key (FREE user) ---');
  // Simulating a request where body requires team scope
  const res4 = await app.inject({ method: 'POST', url: '/api/v1/api-keys', payload: { scope: 'TEAM' } });
  console.log(`Status: ${res4.statusCode} | Body: ${res4.body}`);
}

runGatesTest();
