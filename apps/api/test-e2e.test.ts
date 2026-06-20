import { describe, it, expect, vi } from 'vitest';
import { build } from './src/index';
import { env } from './src/config/env';

// Mock Stripe so we don't hit the real API
vi.mock('stripe', () => {
  return {
    default: class StripeMock {
      checkout = {
        sessions: {
          create: async () => ({ url: 'https://checkout.stripe.com/test_url' })
        }
      };
      webhooks = {
        constructEvent: (payload: any) => JSON.parse(payload)
      };
    }
  };
});

describe('Full Free -> Stripe -> Pro Integration Test', () => {
  it('runs the full flow', async () => {
    const app = await build();

    // 1. MOCK PRISMA
    const mockDb = {
      users: [] as any[],
      subscriptions: [] as any[]
    };

    app.prisma = {
      user: {
        upsert: async ({ where, update, create }: any) => {
          let user = mockDb.users.find(u => u.authProviderId === where.authProviderId);
          if (user) {
            user = { ...user, ...update };
          } else {
            user = { id: 'user_' + Math.random().toString(36).substr(2, 9), ...create, subscription: null, teamMembers: [] };
            mockDb.users.push(user);
          }
          return { ...user, teamMembers: user.teamMembers || [] };
        },
        findUnique: async ({ where }: any) => {
          const u = mockDb.users.find(u => u.id === where.id || u.authProviderId === where.authProviderId);
          return u ? { ...u, teamMembers: u.teamMembers || [] } : null;
        }
      },
      subscription: {
        findUnique: async ({ where }: any) => {
          return mockDb.subscriptions.find(s => s.userId === where.userId || s.stripeSubscriptionId === where.stripeSubscriptionId) || null;
        },
        create: async ({ data }: any) => {
          const sub = { id: 'sub_' + Math.random().toString(36).substr(2, 9), ...data };
          mockDb.subscriptions.push(sub);
          return sub;
        },
        update: async ({ where, data }: any) => {
          const index = mockDb.subscriptions.findIndex(s => s.id === where.id);
          if (index > -1) {
            mockDb.subscriptions[index] = { ...mockDb.subscriptions[index], ...data };
            return mockDb.subscriptions[index];
          }
          return null;
        }
      },
      processedWebhookEvent: {
        findUnique: async () => null,
        create: async () => ({})
      }
    } as any;

    console.log('\n[TEST 1] Calling /api/v1/auth/dev-login');
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/dev-login'
    });
    
    expect(loginRes.statusCode).toBe(200);
    const loginData = loginRes.json();
    const token = loginData.token;
    const userId = loginData.user.id;
    console.log('PASS: JWT received for user:', userId);

    console.log('\n[TEST 2] Calling /api/v1/billing/checkout with JWT');
    const checkoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      headers: {
        Authorization: `Bearer ${token}`
      },
      payload: {
        plan: 'PRO'
      }
    });
    
    expect(checkoutRes.statusCode).toBe(200);
    const checkoutData = checkoutRes.json();
    expect(checkoutData.url).toBe('https://checkout.stripe.com/test_url');
    console.log('PASS: Stripe Checkout URL generated');

    console.log('\n[TEST 3] Simulating Stripe webhook: checkout.session.completed');
    const payload = {
      id: 'evt_test',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test',
          customer: 'cus_test',
          subscription: 'sub_test',
          metadata: {
            userId: userId,
            intendedPlan: 'PRO'
          }
        }
      }
    };
    const payloadString = JSON.stringify(payload, null, 2);

    const webhookRes = await app.inject({
      method: 'POST',
      url: '/api/v1/billing/webhook',
      headers: {
        'stripe-signature': 'test_signature',
        'content-type': 'application/json'
      },
      payload: payloadString
    });

    expect(webhookRes.statusCode).toBe(200);
    console.log('PASS: Webhook successfully received');

    console.log('\n[TEST 4] Verifying updated subscription in DB');
    const sub = await app.prisma.subscription.findUnique({ where: { userId } });
    
    expect(sub).toBeDefined();
    expect(sub.plan).toBe('PRO');
    expect(sub.status).toBe('ACTIVE');
    
    console.log('PASS: Subscription correctly updated to PRO/ACTIVE');
  });
});
