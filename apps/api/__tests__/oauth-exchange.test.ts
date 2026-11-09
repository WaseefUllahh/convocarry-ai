import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import jwt from 'jsonwebtoken';

const config = vi.hoisted(() => ({ GOOGLE_CLIENT_ID: 'extension.apps.googleusercontent.com', JWT_SECRET: 'test-only-secret-at-least-32-characters', JWT_EXPIRES_IN: '1h', NODE_ENV: 'test', ENABLE_DEV_LOGIN: 'false' }));
vi.mock('../src/config/env', () => ({ env: config }));
import authRoutes from '../src/routes/auth';

beforeEach(() => { config.GOOGLE_CLIENT_ID = 'extension.apps.googleusercontent.com'; });
afterEach(() => { vi.unstubAllGlobals(); });

async function exchange(claims: Record<string, unknown>, token = 'google-token') {
  const app = Fastify();
  const upsert = vi.fn().mockResolvedValue({ id: 'alice', authProviderId: 'google-sub', email: 'alice@example.test', subscription: null });
  app.decorate('prisma', { user: { upsert } } as any);
  const request = vi.fn().mockResolvedValue({ ok: true, json: async () => claims });
  vi.stubGlobal('fetch', request);
  await app.register(authRoutes);
  try { return { response: await app.inject({ method: 'POST', url: '/exchange', payload: { token } }), upsert, request }; }
  finally { await app.close(); }
}

const valid = () => ({ aud: config.GOOGLE_CLIENT_ID, sub: 'google-sub', email: 'alice@example.test', email_verified: 'true', expires_in: '3600' });

describe('Google token exchange', () => {
  it('issues a session with the actual JWT expiry', async () => {
    const { response, upsert } = await exchange(valid());
    expect(response.statusCode).toBe(200);
    const result = response.json();
    const claims = jwt.verify(result.token, config.JWT_SECRET) as jwt.JwtPayload;
    expect(result.expiresAt).toBe(new Date(claims.exp! * 1000).toISOString());
    expect(result.user.plan).toBe('FREE');
    expect(upsert).toHaveBeenCalledOnce();
  });
  it.each([
    ['another OAuth app', { aud: 'attacker.apps.googleusercontent.com' }],
    ['missing audience', { aud: undefined }],
    ['expired token', { expires_in: '0' }],
    ['missing expiry', { expires_in: undefined }],
    ['unverified email', { email_verified: false }],
    ['missing identity', { sub: undefined }],
  ])('rejects %s before touching users', async (_name, override) => {
    const { response, upsert } = await exchange({ ...valid(), ...override });
    expect(response.statusCode).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });
  it('fails closed when OAuth is unconfigured', async () => {
    config.GOOGLE_CLIENT_ID = '';
    const { response, upsert, request } = await exchange(valid());
    expect(response.statusCode).toBe(503);
    expect(upsert).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
  it('encodes the token as one query parameter', async () => {
    const { request } = await exchange(valid(), 'token&aud=forged');
    const url = new URL(request.mock.calls[0][0]);
    expect(url.searchParams.get('access_token')).toBe('token&aud=forged');
    expect(url.searchParams.has('aud')).toBe(false);
  });
});
