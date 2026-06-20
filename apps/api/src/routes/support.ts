import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  category: z.enum(['bug', 'billing', 'adapter_issue', 'feature_request', 'account_handoff', 'mcp', 'other']),
  message: z.string().min(10).max(5000),
  browserVersion: z.string().optional(),
  extensionVersion: z.string().optional(),
  diagnosticsOptIn: z.boolean().default(false)
});

// A simple in-memory rate limiter for the MVP
const rateLimiter = new Map<string, { count: number; firstRequest: number }>();

export default async function supportRoutes(fastify: FastifyInstance) {
  fastify.post('/contact', async (request, reply) => {
    // 1. Rate Limiting (max 5 requests per IP per hour)
    const ip = request.ip || 'unknown';
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1 hour

    let rateData = rateLimiter.get(ip);
    if (!rateData || now - rateData.firstRequest > windowMs) {
      rateData = { count: 0, firstRequest: now };
    }

    if (rateData.count >= 5) {
      return reply.status(429).send({ error: 'Too many support requests. Please try again later.' });
    }

    rateData.count++;
    rateLimiter.set(ip, rateData);

    // 2. Validation
    const parsed = contactSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid payload', details: parsed.error.issues });
    }

    const { email, category, message, browserVersion, extensionVersion, diagnosticsOptIn } = parsed.data;

    // 3. Forward to Support Inbox (Mock)
    fastify.log.info({
      msg: 'Forwarding support ticket to support@convocarry.ai',
      ticket: {
        email,
        category,
        messagePreview: message.substring(0, 100) + '...',
        browserVersion: diagnosticsOptIn ? browserVersion : undefined,
        extensionVersion: diagnosticsOptIn ? extensionVersion : undefined
      }
    });

    // We do NOT include Carry Card context in this payload automatically.

    return reply.status(200).send({ success: true, message: 'Support ticket received.' });
  });
}
