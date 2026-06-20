// lib/activationTracker.ts

/**
 * Shared helper for centralized activation tracking.
 * Ensures we:
 * - mark milestones locally
 * - dispatch UI events for checklists
 * - send server analytics ONLY when authenticated
 * - strip sensitive data
 */

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
  | 'checkout_returned_success'
  | 'adapter_error_seen'
  | 'feedback_submitted';

export async function trackActivation(
  eventName: ActivationEventName,
  options?: {
    platform?: 'chatgpt' | 'claude' | 'dashboard' | 'mcp' | 'other';
    success?: boolean;
    errorCode?: string;
  }
) {
  // 1. Mark local state (in extension context or dashboard)
  const localKey = `cc_milestone_${eventName}`;
  let alreadyFired = false;
  try {
    alreadyFired = localStorage.getItem(localKey) === 'true';
    if (!alreadyFired) {
      localStorage.setItem(localKey, 'true');
    }
  } catch { /* ignore */ }

  // 2. Dispatch UI event (so FirstRunChecklist can update)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('cc_activation_event', { detail: { event: eventName } })
    );
  }

  // 3. Prevent duplicate server analytics for one-off milestones
  if (eventName.startsWith('first_') && alreadyFired) {
    return;
  }

  // 4. Send server event (only if authenticated)
  // We do NOT block the UI if this fails.
  try {
    const token = localStorage.getItem('cc_access_token');
    if (!token) return; // Unsigned Free users skip server tracking

    // Do NOT send `rawSnapshot`, `contextBody`, `conversationText`, etc.
    const payload = {
      event: eventName,
      timestamp: new Date().toISOString(),
      plan: localStorage.getItem('cc_plan') || 'FREE', // cached effective plan
      platform: options?.platform || 'dashboard',
      ...(options?.success !== undefined && { success: options.success }),
      ...(options?.errorCode !== undefined && { errorCode: options.errorCode }),
    };

    const API_URL = import.meta.env.VITE_API_URL || 'https://api.convocarry.ai/api/v1';
    
    await fetch(`${API_URL}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

  } catch (error) {
    console.warn('[ActivationTracker] Failed to send analytics:', error);
  }
}
