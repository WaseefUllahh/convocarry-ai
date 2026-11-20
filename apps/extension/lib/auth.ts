import { db } from './storage/db';
import { API_BASE_URL } from './api/config';

export interface Session {
  token: string;
  expiresAt: string;
  user: { id: string; email: string; plan: 'FREE' | 'PRO' | 'TEAM' };
}

export function isGoogleSignInConfigured(): boolean {
  return typeof chrome !== 'undefined' &&
    !!chrome.runtime?.getManifest().oauth2?.client_id &&
    typeof chrome.identity?.getAuthToken === 'function';
}

function isSession(value: unknown): value is Session {
  const session = value as Session | null;
  return !!session && typeof session.token === 'string' && !!session.token &&
    typeof session.expiresAt === 'string' && Date.parse(session.expiresAt) > Date.now() + 60_000 &&
    typeof session.user?.id === 'string' && typeof session.user.email === 'string' &&
    ['FREE', 'PRO', 'TEAM'].includes(session.user.plan);
}

export const auth = {
  async getSession(): Promise<Session | null> {
    const stored = await db.settings.get('session');
    if (isSession(stored?.value)) return stored.value;
    if (stored) await db.settings.delete('session');
    return null;
  },

  /** Called only by an explicit sign-in click, never by popup initialization or sync. */
  async signIn(): Promise<Session> {
    if (!isGoogleSignInConfigured()) {
      throw new Error('Google sign-in is unavailable in this build. You can continue locally.');
    }
    const googleToken = await new Promise<string>((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        const error = chrome.runtime.lastError;
        if (error || !token) reject(new Error(error?.message || 'Google sign-in was cancelled.'));
        else resolve(token);
      });
    });
    const response = await fetch(`${API_BASE_URL}/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: googleToken }),
    });
    if (!response.ok) {
      if (response.status === 401) {
        await new Promise<void>(resolve => chrome.identity.removeCachedAuthToken({ token: googleToken }, () => {
          void chrome.runtime.lastError;
          resolve();
        }));
      }
      throw new Error('ConvoCarry sign-in failed. Check the API configuration or try again.');
    }
    const session: unknown = await response.json();
    if (!isSession(session)) throw new Error('The server returned an invalid or expired session.');
    await db.transaction('rw', db.settings, async () => {
      const previousOwner = await db.settings.get('syncAccountId');
      if (previousOwner?.value !== session.user.id) await db.settings.delete('lastSyncTimestamp');
      await db.settings.put({ key: 'syncAccountId', value: session.user.id });
      await db.settings.put({ key: 'session', value: session });
      await db.settings.bulkDelete(['sessionJwt', 'sessionJwtExpires']);
    });
    return session;
  },

  async signOut(): Promise<void> {
    await db.settings.bulkDelete(['session', 'sessionJwt', 'sessionJwtExpires']);
    if (chrome.storage?.sync?.remove) await chrome.storage.sync.remove(['cc_access_token', 'cc_plan']);
    if (typeof chrome.identity?.clearAllCachedAuthTokens === 'function') {
      await new Promise<void>(resolve => chrome.identity.clearAllCachedAuthTokens(() => {
        void chrome.runtime.lastError;
        resolve();
      }));
    }
  },
};
