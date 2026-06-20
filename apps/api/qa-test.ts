import { FastifyInstance } from 'fastify';
import eventsRoutes from './src/routes/events';
import fastify from 'fastify';

async function runTests() {
  const app = fastify();
  
  // Mock requireUser to inject a fake user
  app.decorate('requireUser', async (request: any) => {
    request.user = { id: 'test-free-user' };
  });

  // Mock Prisma
  app.decorate('prisma', {
    usageEvent: {
      create: async () => ({})
    }
  });

  app.register(eventsRoutes, { prefix: '/api/v1' });

  await app.ready();

  console.log('--- TEST 1: Recursive Deny-List Strict Match ---');
  const payload1 = {
    "event_name": "feedback_submitted",
    "metadata": {
      "debug": {
        "rawSnapshot": "secret transcript"
      }
    }
  };

  const response1 = await app.inject({
    method: 'POST',
    url: '/api/v1/events',
    payload: payload1
  });

  console.log(`Status: ${response1.statusCode}`);
  console.log(`Body: ${response1.body}`);
  
  if (response1.statusCode === 400 && response1.body.includes('rawSnapshot')) {
    console.log('PASS: Recursive deny-list successfully rejected rawSnapshot payload before schema validation.');
  } else {
    console.log('FAIL: Recursive deny-list failed.');
  }

  console.log('\n--- TEST 2: Recursive Deny-List Max Depth Exceeded ---');
  // Build a payload 12 levels deep
  let deepPayload: any = { value: "safe" };
  for (let i = 0; i < 12; i++) {
    deepPayload = { nested: deepPayload };
  }
  const payload2 = {
    event: "feedback_submitted",
    timestamp: new Date().toISOString(),
    plan: "FREE",
    metadata: deepPayload
  };

  const response2 = await app.inject({
    method: 'POST',
    url: '/api/v1/events',
    payload: payload2
  });

  console.log(`Status: ${response2.statusCode}`);
  console.log(`Body: ${response2.body}`);

  if (response2.statusCode === 400 && response2.body.includes('MAX_DEPTH_EXCEEDED')) {
    console.log('PASS: Depth limit strictly rejected.');
  } else {
    console.log('FAIL: Depth limit test failed.');
  }

  process.exit(0);
}

runTests();
