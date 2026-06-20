/**
 * ============================================================
 * ConvoCarry AI — Activation Event Telemetry Schema
 * ============================================================
 *
 * CRITICAL PRIVACY RULES — READ BEFORE ADDING FIELDS
 * ---------------------------------------------------
 * These events are telemetry-only. They MUST NOT contain any
 * user-generated content or personally identifying conversational
 * data. Specifically:
 *
 *  ✗ DO NOT include:  Carry Card content (contextBody, title, tags)
 *  ✗ DO NOT include:  rawSnapshot or any raw conversation snapshot
 *  ✗ DO NOT include:  full conversation text or excerpts
 *  ✗ DO NOT include:  personal AI prompt content (user messages)
 *  ✗ DO NOT include:  email addresses, display names, or team names
 *
 *  ✓ ONLY track:
 *      - Event name (what happened)
 *      - Timestamp (when it happened)
 *      - Plan (FREE | PRO | TEAM)
 *      - Platform context (chatgpt | claude | dashboard | mcp | other)
 *      - Success / failure flag
 *      - Error code (non-descriptive codes only, no message text)
 *      - Extension / browser version strings
 *
 * Any violation of these rules is a GDPR / SOC-2 compliance risk.
 * ============================================================
 */

// ---------------------------------------------------------------------------
// Event name union — exhaustive list of activation + monetization funnel events
// ---------------------------------------------------------------------------

export type ActivationEventName =
  | 'extension_installed'
  | 'dashboard_opened'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'first_carry_card_captured'
  | 'first_summary_injected'
  | 'first_full_continuation_injected'
  | 'first_copy_fallback_used'
  | 'first_cloud_sync_completed'
  | 'first_handoff_link_created'
  | 'first_handoff_claim_completed'
  | 'first_mcp_key_created'
  | 'upgrade_modal_opened'
  | 'checkout_started'
  | 'subscription_canceled'
  | 'adapter_error_seen'
  | 'feedback_submitted';

// ---------------------------------------------------------------------------
// Core event shape — only privacy-safe fields allowed (see rules above)
// ---------------------------------------------------------------------------

export interface ActivationEvent {
  /** The specific funnel / activation milestone that occurred. */
  event: ActivationEventName;

  /** ISO 8601 UTC timestamp of when the event was fired client-side. */
  timestamp: string;

  /** The user's current subscription tier at the time of the event. */
  plan: 'FREE' | 'PRO' | 'TEAM';

  /**
   * The surface / integration where the event occurred.
   * Use 'other' for any unlisted or future surface.
   */
  platform?: 'chatgpt' | 'claude' | 'dashboard' | 'mcp' | 'other';

  /**
   * Whether the triggering action succeeded.
   * Omit for events where success/failure is not applicable (e.g. modal opens).
   */
  success?: boolean;

  /**
   * A short, non-descriptive error code (e.g. 'ADAPTER_TIMEOUT', 'PARSE_ERROR').
   * MUST NOT contain user-readable error messages or any conversation content.
   * Only set when success === false.
   */
  errorCode?: string;

  /** Semver string of the ConvoCarry browser extension (e.g. "1.4.2"). */
  extensionVersion?: string;

  /** User agent / browser version string (e.g. "Chrome/125.0.6422.112"). */
  browserVersion?: string;
}

// ---------------------------------------------------------------------------
// Denied field names — used server-side to strip prohibited content
// (mirrored here for documentation purposes)
// ---------------------------------------------------------------------------

/**
 * Field names that are NEVER permitted in an ActivationEvent payload.
 * The API deny-list is enforced server-side; this array documents
 * the same contract for client-side awareness.
 */
export const ACTIVATION_EVENT_DENIED_FIELDS: ReadonlyArray<string> = [
  'contextBody',
  'rawSnapshot',
  'text',
  'content',
  'conversationText',
  'promptContent',
  'userMessage',
  'assistantMessage',
  'title',
  'description',
  'tags',
  'sourceAccountLabel',
] as const;
