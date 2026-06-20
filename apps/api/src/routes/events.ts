import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ACTIVATION_EVENT_DENIED_FIELDS } from '@convocarry/shared-types';

// ---------------------------------------------------------------------------
// Local supplementary deny-list (content-bearing field names not already in
// the shared-types list that could slip through in nested payloads)
// ---------------------------------------------------------------------------

const LOCAL_DENIED_FIELDS = [
  'contextBody',
  'rawSnapshot',
  'conversationText',
  'prompt',
  'messageText',
  'cardContent',
  'transcript',
] as const;

// ---------------------------------------------------------------------------
// Zod schema — mirrors ActivationEvent from shared-types, enforced server-side
// ---------------------------------------------------------------------------

const ActivationEventNameSchema = z.enum([
  'extension_installed',
  'dashboard_opened',
  'onboarding_started',
  'onboarding_completed',
  'first_carry_card_captured',
  'first_summary_injected',
  'first_full_continuation_injected',
  'first_copy_fallback_used',
  'first_cloud_sync_completed',
  'first_handoff_link_created',
  'first_handoff_claim_completed',
  'first_mcp_key_created',
  'upgrade_modal_opened',
  'checkout_started',
  'checkout_returned_success',
  'adapter_error_seen',
  'feedback_submitted',
]);

const ActivationEventSchema = z.object({
  event:            ActivationEventNameSchema,
  timestamp:        z.string().datetime({ message: 'timestamp must be ISO 8601' }),
  plan:             z.enum(['FREE', 'PRO', 'TEAM']),
  platform:         z.enum(['chatgpt', 'claude', 'dashboard', 'mcp', 'other']).optional(),
  success:          z.boolean().optional(),
  /**
   * Short machine-readable error code only — no human-readable message content.
   * Max 64 chars to prevent accidental inclusion of full error strings.
   */
  errorCode:        z.string().max(64).optional(),
  extensionVersion: z.string().max(32).optional(),
  browserVersion:   z.string().max(128).optional(),
});

// ---------------------------------------------------------------------------
// In-memory per-user rate limiter (max 60 events / minute)
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_MAX    = 60;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in ms

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  let entry = rateLimitStore.get(userId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    // Reset window
    entry = { count: 0, windowStart: now };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false; // exceeded
  }

  entry.count++;
  rateLimitStore.set(userId, entry);
  return true;
}

// ---------------------------------------------------------------------------
// Deny-list guard — recursively walks the entire object tree so that nested
// objects and arrays cannot be used to smuggle prohibited content fields.
//
// Safety guarantees:
//   • Circular reference guard  — visited Set prevents infinite loops
//   • Max depth of 10           — prevents stack-overflow via deeply nested payloads
//   • Fail-fast                 — returns the first offending field name immediately
//   • Dual deny-list            — checks both ACTIVATION_EVENT_DENIED_FIELDS (shared)
//                                 and LOCAL_DENIED_FIELDS (local supplements)
// ---------------------------------------------------------------------------

function containsDeniedFields(
  obj: unknown,
  visited = new Set<object>(),
  depth = 0,
): string | null {
  // Guard: max depth reached — reject entirely rather than silently skipping
  if (depth > 10) return "MAX_DEPTH_EXCEEDED";

  // Guard: only inspect plain objects and arrays
  if (obj === null || typeof obj !== 'object') return null;

  // Guard: circular reference — already visited this reference
  if (visited.has(obj)) return null;
  visited.add(obj);

  // Iterate over every key in the current object / array
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    // Check the key itself against both deny-lists (fast path)
    if (
      (ACTIVATION_EVENT_DENIED_FIELDS as ReadonlyArray<string>).includes(key) ||
      (LOCAL_DENIED_FIELDS as ReadonlyArray<string>).includes(key)
    ) {
      return key;
    }

    // Recurse into nested objects / arrays
    const value = (obj as Record<string, unknown>)[key];
    if (value !== null && typeof value === 'object') {
      if (Array.isArray(value)) {
        // Recurse into each array element
        for (const element of value) {
          const hit = containsDeniedFields(element, visited, depth + 1);
          if (hit) return hit;
        }
      } else {
        const hit = containsDeniedFields(value, visited, depth + 1);
        if (hit) return hit;
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export default async function eventsRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/events
   *
   * Ingest a single activation / funnel event.
   *
   * Privacy contract:
   *   - Authenticated users only (request.user must exist).
   *   - Payload is validated against ActivationEventSchema.
   *   - Any field in ACTIVATION_EVENT_DENIED_FIELDS causes a 400 rejection.
   *   - Stored to UsageEvent.eventType + UsageEvent.metadata (no content fields).
   *   - Rate-limited to 60 events per minute per user.
   */
  fastify.post(
    '/events',
    { preValidation: [fastify.requireUser] },
    async (request, reply) => {
      const userId = request.user.id;

      // 1. Rate limit check
      if (!checkRateLimit(userId)) {
        return reply.status(429).send({
          error: 'Too Many Requests',
          message: 'Event rate limit exceeded: max 60 events per minute.',
        });
      }

      // 2. Deny-list check on raw body before Zod parsing
      //    Rejects any payload that includes prohibited content-bearing fields.
      const rawBody = request.body as Record<string, unknown>;
      const deniedField = containsDeniedFields(rawBody);
      if (deniedField) {
        fastify.log.warn({ userId, deniedField }, 'Activation event rejected: denied field present');
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Field "${deniedField}" is not permitted in activation events (privacy policy).`,
        });
      }

      // 3. Zod validation
      const parsed = ActivationEventSchema.safeParse(rawBody);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation Error',
          details: parsed.error.issues,
        });
      }

      const { event, timestamp, plan, platform, success, errorCode, extensionVersion, browserVersion } = parsed.data;

      // 4. Persist to UsageEvent
      //    eventType = event name; metadata = all remaining safe fields.
      await fastify.prisma.usageEvent.create({
        data: {
          userId,
          eventType: event,
          metadata: {
            timestamp,
            plan,
            ...(platform         !== undefined && { platform }),
            ...(success          !== undefined && { success }),
            ...(errorCode        !== undefined && { errorCode }),
            ...(extensionVersion !== undefined && { extensionVersion }),
            ...(browserVersion   !== undefined && { browserVersion }),
          },
        },
      });

      fastify.log.info({ userId, event, plan, platform }, 'Activation event recorded');

      return reply.status(200).send({ success: true });
    },
  );
}
