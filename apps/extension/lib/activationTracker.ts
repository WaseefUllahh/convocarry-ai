import type { ActivationEventName } from '@convocarry/shared-types';

/**
 * Extension-specific Activation Tracker
 * Uses chrome.storage.local instead of localStorage.
 */
export async function trackActivation(
  eventName: ActivationEventName,
  options?: {
    platform?: 'chatgpt' | 'claude' | 'dashboard' | 'mcp' | 'other';
    success?: boolean;
    errorCode?: string;
  }
) {
  const localKey = `cc_milestone_${eventName}`;
  
  // 1. Mark local state via extension storage
  const storageData = await chrome.storage.local.get([localKey]);
  const alreadyFired = storageData[localKey] === true;

  if (!alreadyFired) {
    await chrome.storage.local.set({ [localKey]: true });
  }

  // 2. Prevent duplicate server analytics for one-off milestones
  if (eventName.startsWith('first_') && alreadyFired) {
    return;
  }

  // 3. Dispatch to any active extension pages (popup/dashboard)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('cc_activation_event', { detail: { event: eventName } })
    );
  }

  // 4. Send server event if signed in (via Chrome Identity or synced token)
  try {
    const { cc_access_token, cc_plan } = await chrome.storage.sync.get(['cc_access_token', 'cc_plan']);
    if (!cc_access_token) return; // Free user fallback

    const payload = {
      event: eventName,
      timestamp: new Date().toISOString(),
      plan: cc_plan || 'FREE',
      platform: options?.platform || 'other',
      ...(options?.success !== undefined && { success: options.success }),
      ...(options?.errorCode !== undefined && { errorCode: options.errorCode }),
    };

    const API_URL = 'https://api.convocarry.ai/api/v1'; // TODO: use env
    
    await fetch(`${API_URL}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cc_access_token}`
      },
      body: JSON.stringify(payload)
    });

  } catch (error) {
    console.warn('[ActivationTracker] Failed to send analytics:', error);
  }
}
