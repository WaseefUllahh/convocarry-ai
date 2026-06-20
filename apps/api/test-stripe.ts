import fastify from 'fastify';
import billingRoutes from './src/routes/billing';
import crypto from 'crypto';

// Minimal Stripe Mock
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/pay/cs_test_123' })
      }
    },
    webhooks: {
      constructEvent: jest.fn().mockImplementation((body, sig, secret) => {
        return JSON.parse(body); // Bypass real crypto for test
      })
    }
  }));
});

async function runStripeTest() {
  const app = fastify();

  // Mock env
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123';

  app.decorate('requireUser', async (request: any) => {
    request.user = { id: 'usr_free_123', plan: 'FREE' };
  });

  const db: any[] = [];
  app.decorate('prisma', {
    subscription: {
      findUnique: async () => null,
      create: async (args: any) => { db.push(args.data); return args.data; }
    },
    processedWebhookEvent: {
      findUnique: async () => null,
      create: async () => ({})
    }
  });

  // Fastify raw body parser for webhook signature
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      const parsed = JSON.parse(body as string);
      (req as any).rawBody = body;
      done(null, parsed);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.register(billingRoutes, { prefix: '/api/v1/billing' });
  await app.ready();

  console.log('--- STRIPE TEST 1: Checkout Session Creation ---');
  const res1 = await app.inject({
    method: 'POST',
    url: '/api/v1/billing/checkout',
    payload: { plan: 'PRO' }
  });
  console.log(`Status: ${res1.statusCode}`);
  console.log(`Body: ${res1.body}`);

  console.log('\n--- STRIPE TEST 2: Webhook Processing ---');
  const mockWebhookPayload = JSON.stringify({
    id: 'evt_test_123',
    type: 'checkout.session.completed',
    data: {
      object: {
        customer: 'cus_123',
        subscription: 'sub_123',
        client_reference_id: 'usr_free_123',
        metadata: { userId: 'usr_free_123', intendedPlan: 'PRO' }
      }
    }
  });

  const res2 = await app.inject({
    method: 'POST',
    url: '/api/v1/billing/webhook',
    headers: { 'stripe-signature': 't=123,v1=mock_sig' },
    payload: mockWebhookPayload
  });
  console.log(`Status: ${res2.statusCode}`);
  console.log(`Body: ${res2.body}`);
  console.log(`DB State:`, db);
}

runStripeTest().catch(console.error);
