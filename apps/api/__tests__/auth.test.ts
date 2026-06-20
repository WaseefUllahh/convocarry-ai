import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { build } from '../src/index';
import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';

describe('API Security and Auth', () => {
  let app: FastifyInstance;
  let testUserId: string;
  let otherUserId: string;
  let testCardId: string;
  let otherCardId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await build();
    await app.ready();

    // Setup Test Data
    const user1 = await app.prisma.user.upsert({
      where: { authProviderId: 'test-user-1' },
      update: {},
      create: { authProviderId: 'test-user-1', email: 'user1@test.com' }
    });
    testUserId = user1.id;

    const user2 = await app.prisma.user.upsert({
      where: { authProviderId: 'test-user-2' },
      update: {},
      create: { authProviderId: 'test-user-2', email: 'user2@test.com' }
    });
    otherUserId = user2.id;

    const card1 = await app.prisma.carryCard.create({
      data: { ownerId: testUserId, title: 'User 1 Card', tags: [] }
    });
    testCardId = card1.id;

    const card2 = await app.prisma.carryCard.create({
      data: { ownerId: otherUserId, title: 'User 2 Card', tags: [] }
    });
    otherCardId = card2.id;
  });

  afterAll(async () => {
    // Cleanup
    await app.prisma.carryCard.deleteMany({
      where: { id: { in: [testCardId, otherCardId] } }
    });
    await app.prisma.user.deleteMany({
      where: { id: { in: [testUserId, otherUserId] } }
    });
    await app.close();
  });

  const generateTestToken = (sub: string, email: string) => {
    return jwt.sign({ sub, email }, 'test-secret');
  };

  it('rejects unauthenticated request', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/cards',
    });
    
    expect(response.statusCode).toBe(401);
    expect(response.json().message).toBe('Missing or invalid Authorization header');
  });

  it('creates/upserts authenticated user', async () => {
    const token = generateTestToken('new-user-auth', 'new@test.com');
    
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/session',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'new@test.com', displayName: 'New User' }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user.email).toBe('new@test.com');

    // Cleanup new user
    await app.prisma.user.deleteMany({ where: { email: 'new@test.com' } });
  });

  it('user cannot read another users Carry Card', async () => {
    const token = generateTestToken('test-user-1', 'user1@test.com');
    
    // Try to access user 2's card using user 1's token
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/cards/${otherCardId}`,
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().message).toBe('You do not have access to this card');
  });

  it('user can read their own Carry Card', async () => {
    const token = generateTestToken('test-user-1', 'user1@test.com');
    
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/cards/${testCardId}`,
      headers: { authorization: `Bearer ${token}` }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(testCardId);
  });
});
