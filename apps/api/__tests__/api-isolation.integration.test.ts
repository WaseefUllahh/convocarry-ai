import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { build } from '../src/index';
import type { FastifyInstance } from 'fastify';

// Skip database integration tests in routine local unit-test runs.
// The CI integration job sets NODE_ENV=test and a dedicated convocarry_test database.
const hasIsolatedDb = process.env.NODE_ENV === 'test' && process.env.DATABASE_URL?.includes('convocarry_test');
(hasIsolatedDb ? describe : describe.skip)('Real PostgreSQL multi-user authorization', () => {
  let app: FastifyInstance;
  let alice: { id: string; authProviderId: string };
  let bob: { id: string; authProviderId: string };
  let aliceCardId: string;
  let bobCardId: string;
  let bobVersionId: string;
  let aliceToken: string;
  let bobToken: string;
  const nonce = crypto.randomUUID();

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL?.includes('convocarry_test')) {
      throw new Error('Refusing to run integration tests outside isolated convocarry_test database');
    }
    app = await build();
    await app.ready();

    alice = await app.prisma.user.create({
      data: { authProviderId: `integration-alice-${nonce}`, email: `alice-${nonce}@example.test` }
    });
    bob = await app.prisma.user.create({
      data: { authProviderId: `integration-bob-${nonce}`, email: `bob-${nonce}@example.test` }
    });

    await app.prisma.subscription.createMany({
      data: [
        { userId: alice.id, plan: 'PRO', status: 'ACTIVE' },
        { userId: bob.id, plan: 'PRO', status: 'ACTIVE' }
      ]
    });

    const own = await app.prisma.carryCard.create({ data: { ownerId: alice.id, title: 'Alice private card', tags: [] } });
    const foreign = await app.prisma.carryCard.create({ data: { ownerId: bob.id, title: 'Bob private card', tags: [] } });
    aliceCardId = own.id;
    bobCardId = foreign.id;
    const version = await app.prisma.carryCardVersion.create({
      data: { carryCardId: bobCardId, platform: 'chatgpt', contextBody: [{ role: 'user', text: 'Bob confidential message' }] }
    });
    bobVersionId = version.id;
    await app.prisma.carryCard.update({ where: { id: bobCardId }, data: { currentVersionId: bobVersionId } });

    const secret = process.env.JWT_SECRET!;
    aliceToken = jwt.sign({ sub: alice.authProviderId, email: `alice-${nonce}@example.test` }, secret);
    bobToken = jwt.sign({ sub: bob.authProviderId, email: `bob-${nonce}@example.test` }, secret);
  }, 30_000);

  afterAll(async () => {
    if (!app) return;
    if (alice && bob) {
      const userIds = [alice.id, bob.id];
      await app.prisma.carryCard.updateMany({ where: { ownerId: { in: userIds } }, data: { currentVersionId: null } });
      await app.prisma.carryCard.deleteMany({ where: { ownerId: { in: userIds } } });
      await app.prisma.apiKey.deleteMany({ where: { userId: { in: userIds } } });
      await app.prisma.subscription.deleteMany({ where: { userId: { in: userIds } } });
      await app.prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await app.close();
  }, 30_000);

  it('keeps normal owner access working', async () => {
    const response = await app.inject({
      method: 'GET', url: `/api/v1/cards/${bobCardId}`,
      headers: { authorization: `Bearer ${bobToken}` }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(bobCardId);
  });

  it('denies cross-user reading a private Carry Card', async () => {
    const response = await app.inject({
      method: 'GET', url: `/api/v1/cards/${bobCardId}`,
      headers: { authorization: `Bearer ${aliceToken}` }
    });
    expect(response.statusCode).toBe(403);
    expect(response.body).not.toContain('Bob confidential message');
  });

  it('denies uploading a version into another user\'s card', async () => {
    const maliciousVersionId = crypto.randomUUID();
    const response = await app.inject({
      method: 'POST', url: '/api/v1/sync/push',
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        cards: [],
        versions: [{ id: maliciousVersionId, carryCardId: bobCardId, platform: 'chatgpt', contextBody: [{ role: 'user', text: 'overwrite' }] }]
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().errors).toEqual([expect.stringContaining('Forbidden')]);
    expect(await app.prisma.carryCardVersion.findUnique({ where: { id: maliciousVersionId } })).toBeNull();
  });

  it('denies cross-card version-pointer edits and rollback', async () => {
    const headers = { authorization: `Bearer ${aliceToken}` };
    const patch = await app.inject({
      method: 'PATCH', url: `/api/v1/cards/${aliceCardId}`,
      headers, payload: { currentVersionId: bobVersionId }
    });
    expect(patch.statusCode).toBe(400);

    const rollback = await app.inject({
      method: 'POST', url: `/api/v1/cards/${aliceCardId}/versions/${bobVersionId}/rollback`,
      headers
    });
    expect(rollback.statusCode).toBe(404);
    expect((await app.prisma.carryCard.findUnique({ where: { id: aliceCardId } }))?.currentVersionId).toBeNull();
  });

  it('rejects a foreign-version pointer during cloud synchronization', async () => {
    const response = await app.inject({
      method: 'POST', url: '/api/v1/sync/push',
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        cards: [{ id: aliceCardId, title: 'Alice card edited', tags: [], updatedAt: '2030-01-01T00:00:00.000Z', currentVersionId: bobVersionId }],
        versions: []
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().errors).toEqual([expect.stringContaining('Active version does not belong')]);
    expect((await app.prisma.carryCard.findUnique({ where: { id: aliceCardId } }))?.currentVersionId).toBeNull();
  });

  it('accepts a legitimate new card and its version in one sync request', async () => {
    const cardId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const response = await app.inject({
      method: 'POST', url: '/api/v1/sync/push',
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        cards: [{ id: cardId, title: 'Alice new', tags: [], currentVersionId: versionId, updatedAt: new Date().toISOString() }],
        versions: [{ id: versionId, carryCardId: cardId, platform: 'chatgpt', contextBody: [] }]
      }
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().errors).toEqual([]);
    expect((await app.prisma.carryCard.findUnique({ where: { id: cardId } }))?.currentVersionId).toBe(versionId);
  });

  it('rejects expired API keys before MCP request processing', async () => {
    const secretPart = crypto.randomBytes(24).toString('hex');
    const hashedKey = crypto.createHash('sha256').update(secretPart).digest('hex');
    const key = await app.prisma.apiKey.create({
      data: { userId: alice.id, label: 'expired test key', hashedKey, scopes: ['mcp:read'], expiresAt: new Date('2020-01-01') }
    });
    const response = await app.inject({
      method: 'POST', url: '/mcp', headers: { authorization: `Bearer cc_live_${secretPart}` }, payload: {}
    });
    expect(response.statusCode).toBe(401);
    await app.prisma.apiKey.delete({ where: { id: key.id } });
  });
});
