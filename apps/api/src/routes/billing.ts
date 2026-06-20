import { FastifyInstance } from 'fastify';
import Stripe from 'stripe';
import { env } from '../config/env';

export default async function (server: FastifyInstance) {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' });

  // GET /billing/plan
  server.get('/plan', { preValidation: [server.requireUser] }, async (request, reply) => {
    const userId = request.user.id;
    const userSub = await server.prisma.subscription.findUnique({ where: { userId } });
    
    // Check team subs as well to return comprehensive view if needed, but effective plan is already on request.user
    return {
      plan: request.user.plan,
      hasCustomerRecord: !!userSub?.stripeCustomerId,
      status: userSub?.status || 'FREE',
      cancelAtPeriodEnd: userSub?.cancelAtPeriodEnd || false,
      currentPeriodEnd: userSub?.currentPeriodEnd
    };
  });

  // POST /billing/checkout
  server.post('/checkout', { preValidation: [server.requireUser] }, async (request, reply) => {
    const { plan, teamId } = request.body as any;
    const userId = request.user.id;

    if (plan !== 'PRO' && plan !== 'TEAM') {
      return reply.code(400).send({ error: 'Bad Request', message: 'Invalid plan requested' });
    }

    if (plan === 'TEAM') {
      if (!teamId) return reply.code(400).send({ error: 'Bad Request', message: 'teamId is required for TEAM plan' });
      const member = await server.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } }
      });
      if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Must be OWNER or ADMIN to upgrade team' });
      }
    } else if (teamId) {
      return reply.code(400).send({ error: 'Bad Request', message: 'teamId cannot be provided for PRO plan' });
    }

    const priceId = plan === 'PRO' ? env.STRIPE_PRO_PRICE_ID : env.STRIPE_TEAM_PRICE_ID;
    
    // Check if customer already exists for this context
    let customerId: string | undefined;
    if (plan === 'PRO') {
      const sub = await server.prisma.subscription.findUnique({ where: { userId } });
      if (sub?.stripeCustomerId) customerId = sub.stripeCustomerId;
    } else {
      const sub = await server.prisma.subscription.findUnique({ where: { teamId } });
      if (sub?.stripeCustomerId) customerId = sub.stripeCustomerId;
    }

    const metadata = { userId, intendedPlan: plan, teamId: teamId || '' };

    const sessionData: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: env.STRIPE_CHECKOUT_SUCCESS_URL,
      cancel_url: env.STRIPE_CHECKOUT_CANCEL_URL,
      client_reference_id: userId,
      metadata,
      subscription_data: { metadata }
    };

    if (customerId) sessionData.customer = customerId;

    const session = await stripe.checkout.sessions.create(sessionData);

    return { url: session.url };
  });

  // POST /billing/portal
  server.post('/portal', { preValidation: [server.requireUser] }, async (request, reply) => {
    const userId = request.user.id;
    // For MVP we direct to the personal portal. Team portal logic can be added later.
    const sub = await server.prisma.subscription.findUnique({ where: { userId } });

    if (!sub || !sub.stripeCustomerId) {
      return reply.code(400).send({ error: 'Bad Request', message: 'No billing record found. Upgrade first.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: env.STRIPE_PORTAL_RETURN_URL
    });

    return { url: session.url };
  });

  // POST /billing/webhook
  server.post('/webhook', { config: { rawBody: true } }, async (request, reply) => {
    const rawBody = (request as any).rawBody;
    const signature = request.headers['stripe-signature'];

    server.log.info({
      hasStripeWebhookSecret: !!env.STRIPE_WEBHOOK_SECRET,
      hasStripeSignatureHeader: !!signature,
      rawBodyType: typeof rawBody,
      rawBodyAvailable: !!rawBody
    }, 'Stripe webhook received');

    if (!rawBody || !signature) {
      server.log.error('Webhook missing signature or body');
      return reply.code(400).send({ error: 'Bad Request', message: 'Missing signature or body' });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      server.log.error(`Webhook signature verification failed: ${err.message}`);
      return reply.code(400).send({ error: 'Bad Request', message: 'Invalid signature' });
    }

    // Safely ignore events we don't care about without returning 400
    const ignoredEvents = [
      'product.created', 'product.updated', 'product.deleted',
      'price.created', 'price.updated', 'price.deleted',
      'charge.succeeded', 'charge.updated', 'charge.failed',
      'payment_intent.created', 'payment_intent.succeeded', 'payment_intent.payment_failed'
    ];

    if (ignoredEvents.includes(event.type)) {
      server.log.info(`Stripe webhook ignored: ${event.type}`);
      return reply.code(200).send({ received: true, ignored: true });
    }

    // For checkout.session.completed, if metadata is missing, we can ignore it safely here.
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const { userId, intendedPlan } = session.metadata || {};
      if (!userId || !intendedPlan) {
        server.log.info('checkout.session.completed ignored: missing ConvoCarry metadata');
        return reply.code(200).send({ received: true, ignored: true });
      }
    }

    // Idempotency check
    const processed = await server.prisma.processedWebhookEvent.findUnique({ where: { id: event.id } });
    if (processed) {
      return reply.code(200).send({ received: true }); // Already processed
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const { userId, teamId, intendedPlan } = session.metadata || {};
          const stripeSubscriptionId = session.subscription as string;
          const stripeCustomerId = session.customer as string;

          await upsertSubscription(server, {
            userId: intendedPlan === 'PRO' ? userId : null,
            teamId: intendedPlan === 'TEAM' && teamId ? teamId : null,
            stripeSubscriptionId,
            stripeCustomerId,
            plan: intendedPlan,
            status: 'ACTIVE' // will be updated by customer.subscription.updated anyway
          });
          break;
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          const { userId, teamId, intendedPlan } = subscription.metadata || {};
          
          let planEnum = 'FREE';
          if (intendedPlan === 'PRO' || intendedPlan === 'TEAM') planEnum = intendedPlan;

          let statusEnum = 'ACTIVE';
          switch (subscription.status) {
            case 'trialing': statusEnum = 'TRIALING'; break;
            case 'active': statusEnum = 'ACTIVE'; break;
            case 'past_due': statusEnum = 'PAST_DUE'; break;
            case 'canceled': statusEnum = 'CANCELED'; break;
            case 'unpaid': statusEnum = 'UNPAID'; break;
            case 'incomplete': statusEnum = 'INCOMPLETE'; break;
            case 'incomplete_expired': statusEnum = 'INCOMPLETE_EXPIRED'; break;
            case 'paused': statusEnum = 'PAUSED'; break;
          }

          if (event.type === 'customer.subscription.deleted') {
            statusEnum = 'CANCELED';
          }

          await upsertSubscription(server, {
            userId: intendedPlan === 'PRO' ? userId : null,
            teamId: intendedPlan === 'TEAM' && teamId ? teamId : null,
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: subscription.customer as string,
            plan: planEnum,
            status: statusEnum,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end
          });
          break;
        }

        case 'invoice.paid':
        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          if (!invoice.subscription) break;
          
          // Fetch from Stripe to get the absolute source of truth for the subscription status
          const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
          
          let statusEnum = 'ACTIVE';
          switch (sub.status) {
            case 'trialing': statusEnum = 'TRIALING'; break;
            case 'active': statusEnum = 'ACTIVE'; break;
            case 'past_due': statusEnum = 'PAST_DUE'; break;
            case 'canceled': statusEnum = 'CANCELED'; break;
            case 'unpaid': statusEnum = 'UNPAID'; break;
            case 'incomplete': statusEnum = 'INCOMPLETE'; break;
            case 'incomplete_expired': statusEnum = 'INCOMPLETE_EXPIRED'; break;
            case 'paused': statusEnum = 'PAUSED'; break;
          }

          await server.prisma.subscription.updateMany({
            where: { stripeSubscriptionId: sub.id },
            data: { status: statusEnum as any }
          });
          break;
        }

        default:
          server.log.info(`Stripe webhook unhandled but valid: ${event.type}`);
          break;
      }
      
      // Successfully processed, lock event
      await server.prisma.processedWebhookEvent.create({ data: { id: event.id, type: event.type } });
      
    } catch (err: any) {
      server.log.error(`Failed to process webhook event ${event.id}: ${err.message}`);
      // Return 500 so Stripe knows to retry
      return reply.code(500).send({ error: 'Internal Server Error' });
    }

    return reply.code(200).send({ received: true });
  });
}

// Helper to reliably upsert subscription
async function upsertSubscription(server: FastifyInstance, data: any) {
  if (!data.stripeSubscriptionId) return;

  // We find existing by subscription ID since users can change plans
  const existing = await server.prisma.subscription.findUnique({
    where: { stripeSubscriptionId: data.stripeSubscriptionId }
  });

  if (existing) {
    await server.prisma.subscription.update({
      where: { id: existing.id },
      data: {
        plan: data.plan,
        status: data.status,
        currentPeriodStart: data.currentPeriodStart || existing.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd || existing.currentPeriodEnd,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? existing.cancelAtPeriodEnd
      }
    });
  } else {
    // If we don't have it, we create it. We must ensure EXACTLY ONE owner is present.
    if ((!data.userId && !data.teamId) || (data.userId && data.teamId)) {
      server.log.error(`upsertSubscription failed: Must have exactly one of userId or teamId`);
      return;
    }

    try {
      await server.prisma.subscription.create({
        data: {
          userId: data.userId,
          teamId: data.teamId,
          stripeCustomerId: data.stripeCustomerId,
          stripeSubscriptionId: data.stripeSubscriptionId,
          plan: data.plan,
          status: data.status,
          currentPeriodStart: data.currentPeriodStart,
          currentPeriodEnd: data.currentPeriodEnd,
          cancelAtPeriodEnd: data.cancelAtPeriodEnd || false
        }
      });
    } catch (e) {
      // Could be unique constraint violation if they already had a sub under a different sub ID
      // If so, update the existing owner's subscription instead
      const conflict = data.userId 
        ? await server.prisma.subscription.findUnique({ where: { userId: data.userId } })
        : await server.prisma.subscription.findUnique({ where: { teamId: data.teamId } });
        
      if (conflict) {
        await server.prisma.subscription.update({
          where: { id: conflict.id },
          data: {
            stripeCustomerId: data.stripeCustomerId,
            stripeSubscriptionId: data.stripeSubscriptionId,
            plan: data.plan,
            status: data.status,
            currentPeriodStart: data.currentPeriodStart,
            currentPeriodEnd: data.currentPeriodEnd,
            cancelAtPeriodEnd: data.cancelAtPeriodEnd || false
          }
        });
      }
    }
  }
}
