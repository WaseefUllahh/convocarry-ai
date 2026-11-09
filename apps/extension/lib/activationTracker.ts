import { auth } from './auth';
import { API_BASE_URL } from './api/config';
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
    const session = await auth.getSession();
    if (!session) return;

    const payload = {
      event: eventName,
      timestamp: new Date().toISOString(),
      plan: session.user.plan,
      platform: options?.platform || 'other',
      ...(options?.success !== undefined && { success: options.success }),
      ...(options?.errorCode !== undefined && { errorCode: options.errorCode }),
    };

    
    await fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`
      },
      body: JSON.stringify(payload)
    });

  } catch (error) {
    console.warn('[ActivationTracker] Failed to send analytics:', error);
  }
}
