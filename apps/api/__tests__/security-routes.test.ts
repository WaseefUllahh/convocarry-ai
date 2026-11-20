import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import syncRoutes from '../src/routes/sync';
import cardsRoutes from '../src/routes/cards';

function createMockDb() {
  const cards = new Map<string, any>([
    ['own-card', { id: 'own-card', ownerId: 'alice', teamFolderId: null, deletedAt: null, updatedAt: new Date('2024-01-01') }],
    ['foreign-card', { id: 'foreign-card', ownerId: 'bob', teamFolderId: null, deletedAt: null, updatedAt: new Date('2024-01-01') }]
  ]);
  const versions = new Map<string, any>([
    ['foreign-version', { id: 'foreign-version', carryCardId: 'foreign-card', contextBody: [] }]
  ]);

  const db = {
    deletedCarryCard: { findUnique: vi.fn(async () => null) },
    teamFolder: { findUnique: vi.fn(async () => null) },
    teamMember: { findUnique: vi.fn(async () => null) },
    carryCard: {
      findUnique: vi.fn(async ({ where }: any) => cards.get(where.id) || null),
      create: vi.fn(async ({ data }: any) => {
        const card = { ...data, updatedAt: new Date(), deletedAt: null, teamFolderId: null };
        cards.set(card.id, card);
        return card;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const old = cards.get(where.id);
        if (!old) throw new Error('Card not found');
        const card = { ...old, ...data };
        cards.set(where.id, card);
        return card;
      })
    },
    carryCardVersion: {
      findUnique: vi.fn(async ({ where }: any) => versions.get(where.id) || null),
      create: vi.fn(async ({ data }: any) => {
        const version = { ...data };
        versions.set(version.id, version);
        return version;
      })
    }
  };
  return { db, cards, versions };
}

async function makeApp(route: 'sync' | 'cards') {
  const app = Fastify();
  const mock = createMockDb();
  const user: any = {
    id: 'alice', teams: [], email: 'alice@example.test',
    role: 'user', plan: 'PRO', getEffectivePlan: (teamId?: string) => teamId ? 'FREE' : 'PRO'
  };

  app.decorate('prisma', mock.db as any);
  const auth = async (request: any) => { request.user = user; };
  app.decorate('requireUser', auth);
  app.decorate('requireProOrTeam', auth);
  await app.register(route === 'sync' ? syncRoutes : cardsRoutes, { prefix: route === 'sync' ? '/sync' : '/cards' });
  await app.ready();
  return { app, ...mock };
}

describe('Sync route authorization (real Fastify route, mocked persistence)', () => {
  it('rejects a version upload into another user\'s card', async () => {
    const { app, db } = await makeApp('sync');
    try {
      const res = await app.inject({
        method: 'POST', url: '/sync/push',
        payload: { cards: [], versions: [{ id: 'malicious-version', carryCardId: 'foreign-card', platform: 'chatgpt', contextBody: [] }] }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().errors).toEqual([expect.stringContaining('Forbidden')]);
      expect(db.carryCardVersion.create).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('rejects an unrelated parent version on an owned card', async () => {
    const { app, db } = await makeApp('sync');
    try {
      const res = await app.inject({
        method: 'POST', url: '/sync/push',
        payload: { cards: [], versions: [{ id: 'new-v', carryCardId: 'own-card', parentId: 'foreign-version', platform: 'chatgpt', contextBody: [] }] }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().errors).toEqual([expect.stringContaining('Parent version')]);
      expect(db.carryCardVersion.create).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('creates a new card and its current version in the same batch', async () => {
    const { app, cards } = await makeApp('sync');
    try {
      const res = await app.inject({
        method: 'POST', url: '/sync/push',
        payload: {
          cards: [{ id: 'new-card', title: 'Test', tags: [], updatedAt: '2026-11-09T00:00:00Z', currentVersionId: 'new-version' }],
          versions: [{ id: 'new-version', carryCardId: 'new-card', platform: 'chatgpt', contextBody: [] }]
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().errors).toEqual([]);
      expect(res.json().cardsUpdated).toBe(1);
      expect(res.json().versionsAdded).toBe(1);
      expect(cards.get('new-card').currentVersionId).toBe('new-version');
    } finally { await app.close(); }
  });

  it('rejects an owned card pointing to another card\'s version', async () => {
    const { app, cards } = await makeApp('sync');
    try {
      const res = await app.inject({
        method: 'POST', url: '/sync/push',
        payload: {
          cards: [{ id: 'own-card', title: 'Updated', tags: [], updatedAt: '2030-01-01T00:00:00Z', currentVersionId: 'foreign-version' }],
          versions: []
        }
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().errors).toEqual([expect.stringContaining('Active version does not belong')]);
      expect(cards.get('own-card').currentVersionId).toBeUndefined();
    } finally { await app.close(); }
  });
});

describe('REST card-version isolation', () => {
  it('rejects rollback to a version of a different card', async () => {
    const { app, db } = await makeApp('cards');
    try {
      const res = await app.inject({ method: 'POST', url: '/cards/own-card/versions/foreign-version/rollback' });
      expect(res.statusCode).toBe(404);
      expect(db.carryCard.update).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('rejects PATCH that points a card at another card\'s version', async () => {
    const { app, db } = await makeApp('cards');
    try {
      const res = await app.inject({
        method: 'PATCH', url: '/cards/own-card', payload: { currentVersionId: 'foreign-version' }
      });
      expect(res.statusCode).toBe(400);
      expect(db.carryCard.update).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });

  it('rejects creating a version with a cross-card parent', async () => {
    const { app, db } = await makeApp('cards');
    try {
      const res = await app.inject({
        method: 'POST', url: '/cards/own-card/versions',
        payload: { parentId: 'foreign-version', platform: 'chatgpt', contextBody: [] }
      });
      expect(res.statusCode).toBe(400);
      expect(db.carryCardVersion.create).not.toHaveBeenCalled();
    } finally { await app.close(); }
  });
});
