import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { auth, isGoogleSignInConfigured } from '../lib/auth';
import { db } from '../lib/storage/db';
import { syncEngine } from '../lib/storage/sync';
import { resolveApiBaseUrl } from '../lib/api/config';

const session = () => ({ token: 'app-session', expiresAt: new Date(Date.now() + 3600_000).toISOString(), user: { id: 'alice', email: 'alice@example.test', plan: 'FREE' } });

beforeEach(async () => { await db.settings.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('Optional OAuth and session handling', () => {
  it('works locally with no identity permission and never prompts on session lookup', async () => {
    vi.stubGlobal('chrome', { runtime: { getManifest: () => ({}) } });
    expect(isGoogleSignInConfigured()).toBe(false);
    expect(await auth.getSession()).toBeNull();
    expect(await syncEngine.getAuthToken()).toBeNull();
    await expect(auth.signIn()).rejects.toThrow('continue locally');
  });

  it('exchanges the Google token and preserves the actual FREE plan and server expiry', async () => {
    const value = session();
    const getAuthToken = vi.fn((_options, callback) => callback('google-token'));
    vi.stubGlobal('chrome', { runtime: { getManifest: () => ({ oauth2: { client_id: 'test.apps.googleusercontent.com' } }) }, identity: { getAuthToken } });
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => value });
    vi.stubGlobal('fetch', request);
    await db.settings.put({ key: 'lastSyncTimestamp', value: '2026-01-01' });
    expect(await auth.signIn()).toEqual(value);
    expect(getAuthToken).toHaveBeenCalledWith({ interactive: true }, expect.any(Function));
    expect(request.mock.calls[0][0]).toMatch(/\/api\/v1\/auth\/exchange$/);
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ token: 'google-token' });
    expect(await auth.getSession()).toEqual(value);
    expect(await db.settings.get('lastSyncTimestamp')).toBeUndefined();
    expect(await syncEngine.getAuthToken()).toBe('app-session');
    expect(getAuthToken).toHaveBeenCalledTimes(1);
  });

  it('surfaces a cancelled sign-in without marking the user authenticated', async () => {
    vi.stubGlobal('chrome', { runtime: { getManifest: () => ({ oauth2: { client_id: 'test' } }), lastError: { message: 'User cancelled' } }, identity: { getAuthToken: (_: unknown, callback: (token?: string) => void) => callback() } });
    await expect(auth.signIn()).rejects.toThrow('User cancelled');
    expect(await auth.getSession()).toBeNull();
  });

  it('rejects an expired cached session without opening Google OAuth', async () => {
    await db.settings.put({ key: 'session', value: { ...session(), expiresAt: '2000-01-01T00:00:00Z' } });
    expect(await auth.getSession()).toBeNull();
    expect(await db.settings.get('session')).toBeUndefined();
  });

  it('clears current and legacy session credentials on sign-out', async () => {
    const clearAllCachedAuthTokens = vi.fn(callback => callback());
    vi.stubGlobal('chrome', { runtime: {}, identity: { clearAllCachedAuthTokens } });
    await db.settings.put({ key: 'session', value: session() });
    await db.settings.put({ key: 'sessionJwt', value: 'legacy-token' });
    await auth.signOut();
    expect(await auth.getSession()).toBeNull();
    expect(await db.settings.get('sessionJwt')).toBeUndefined();
    expect(clearAllCachedAuthTokens).toHaveBeenCalledOnce();
  });

  it('normalizes API origins and prefixes, and rejects insecure remote destinations', () => {
    expect(resolveApiBaseUrl('http://localhost:3001')).toBe('http://localhost:3001/api/v1');
    expect(resolveApiBaseUrl('https://example.test/api/v1/')).toBe('https://example.test/api/v1');
    expect(() => resolveApiBaseUrl('http://example.test')).toThrow('HTTPS');
    expect(() => resolveApiBaseUrl('https://user:password@example.test')).toThrow('credentials');
  });
});
