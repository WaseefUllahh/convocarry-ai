/**
 * eventTracker.ts — ConvoCarry Growth + Monetization event tracking utility
 *
 * ─── PRIVACY RULES ─────────────────────────────────────────────────────────────
 * The following fields MUST NEVER be included in any event payload sent to the
 * server or stored locally:
 *   - contextBody
 *   - rawSnapshot
 *   - conversationText
 *   - prompt
 *   - messageText
 *   - cardContent
 *   - transcript
 *
 * These fields could contain sensitive user-generated content (PII, private
 * conversations, proprietary information). Violating this rule is a privacy
 * incident. Always audit payloads before adding new TrackOptions fields.
 * ────────────────────────────────────────────────────────────────────────────────
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTH_TOKEN_KEY = 'convocarry_auth_token';
const PLAN_KEY = 'convocarry_user_plan';
const LOCAL_EVENTS_KEY = 'convocarry_local_events';
const CHECKLIST_KEY = 'convocarry_checklist_v1';

const LOCAL_EVENTS_MAX = 100;
const EVENTS_ENDPOINT = '/api/v1/events';

// ─── Types ────────────────────────────────────────────────────────────────────

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

export interface TrackOptions {
  platform?: 'chatgpt' | 'claude' | 'dashboard' | 'mcp' | 'other';
  success?: boolean;
  errorCode?: string;
  extensionVersion?: string;
  browserVersion?: string;
}

interface EventPayload {
  event: ActivationEventName;
  plan: string;
  ts: string;
  platform?: TrackOptions['platform'];
  success?: boolean;
  errorCode?: string;
  extensionVersion?: string;
  browserVersion?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function getUserPlan(): string {
  try {
    return localStorage.getItem(PLAN_KEY) ?? 'FREE';
  } catch {
    return 'FREE';
  }
}

function buildPayload(
  eventName: ActivationEventName,
  options?: TrackOptions,
): EventPayload {
  // Only include the safe, explicitly-whitelisted fields.
  // NEVER include contextBody, rawSnapshot, conversationText, prompt,
  // messageText, cardContent, or transcript.
  const payload: EventPayload = {
    event: eventName,
    plan: getUserPlan(),
    ts: new Date().toISOString(),
  };

  if (options?.platform !== undefined) payload.platform = options.platform;
  if (options?.success !== undefined) payload.success = options.success;
  if (options?.errorCode !== undefined) payload.errorCode = options.errorCode;
  if (options?.extensionVersion !== undefined) payload.extensionVersion = options.extensionVersion;
  if (options?.browserVersion !== undefined) payload.browserVersion = options.browserVersion;

  return payload;
}

function appendLocalEvent(payload: EventPayload): void {
  try {
    const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
    const events: EventPayload[] = raw ? (JSON.parse(raw) as EventPayload[]) : [];
    events.push(payload);
    // Cap at max entries — remove oldest entries first (FIFO)
    if (events.length > LOCAL_EVENTS_MAX) {
      events.splice(0, events.length - LOCAL_EVENTS_MAX);
    }
    localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(events));
  } catch (err) {
    console.warn('[ConvoCarry] Failed to store local event:', err);
  }
}

async function postEvent(
  payload: EventPayload,
  token: string,
): Promise<void> {
  await fetch(EVENTS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * trackEvent — fire-and-forget event emitter.
 *
 * If the user is authenticated (token present in localStorage under
 * `convocarry_auth_token`), the event is POSTed to `/api/v1/events`.
 * Otherwise it is queued locally in `convocarry_local_events` (max 100
 * entries, oldest dropped) for potential future flush after sign-in.
 *
 * This function NEVER throws. All errors are caught and logged as warnings
 * so that event tracking never blocks or breaks the UI.
 */
export function trackEvent(
  eventName: ActivationEventName,
  options?: TrackOptions,
): void {
  // Run entirely async — fire-and-forget, never await at call sites
  void (async () => {
    try {
      const payload = buildPayload(eventName, options);
      const token = getAuthToken();

      if (token) {
        try {
          await postEvent(payload, token);
        } catch (err) {
          console.warn('[ConvoCarry] Event POST failed, queuing locally:', err);
          appendLocalEvent(payload);
        }
      } else {
        appendLocalEvent(payload);
      }
    } catch (err) {
      // Outer safety net — should never reach here, but just in case
      console.warn('[ConvoCarry] trackEvent unexpected error:', err);
    }
  })();
}

// ─── Checklist helpers ────────────────────────────────────────────────────────

/**
 * markChecklistItem — records that the user has completed a checklist step.
 * Writes an ISO timestamp to `convocarry_checklist_v1[itemId]` in localStorage.
 */
export function markChecklistItem(itemId: string): void {
  try {
    const raw = localStorage.getItem(CHECKLIST_KEY);
    const state: Record<string, string> = raw
      ? (JSON.parse(raw) as Record<string, string>)
      : {};
    if (!state[itemId]) {
      // Only record the first completion time
      state[itemId] = new Date().toISOString();
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify(state));
    }
  } catch (err) {
    console.warn('[ConvoCarry] markChecklistItem failed:', err);
  }
}

/**
 * getChecklistState — returns the full checklist completion map.
 * Keys are item IDs, values are ISO timestamps of first completion.
 * Returns an empty object if nothing has been completed yet.
 */
export function getChecklistState(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CHECKLIST_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch (err) {
    console.warn('[ConvoCarry] getChecklistState failed:', err);
  }
  return {};
}
