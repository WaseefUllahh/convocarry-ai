import { describe, expect, it } from 'vitest';
import { canAccessCloudCard, hasMcpScope, versionBelongsToCard } from '../src/services/card-access';

type Plan = 'FREE' | 'PRO' | 'TEAM';
const makeUser = (id: string, plan: Plan, teams: Record<string, Plan> = {}) => ({
  id,
  teams: Object.keys(teams),
  getEffectivePlan: (teamId?: string) => teamId ? (teams[teamId] || 'FREE') : plan,
});

describe('Carry Card authorization regression checks', () => {
  it('allows a Pro owner to read their own personal card', () => {
    expect(canAccessCloudCard(makeUser('alice', 'PRO'), { ownerId: 'alice' })).toBe(true);
  });

  it('rejects a different Pro user for a personal card', () => {
    expect(canAccessCloudCard(makeUser('bob', 'PRO'), { ownerId: 'alice' })).toBe(false);
  });

  it('rejects a Free owner for paid cloud-card access', () => {
    expect(canAccessCloudCard(makeUser('alice', 'FREE'), { ownerId: 'alice' })).toBe(false);
  });

  it('requires team membership and entitlement, not just card ownership', () => {
    const teamCard = { ownerId: 'alice', teamFolderId: 'folder-1', teamFolder: { teamId: 'team-1' } };
    expect(canAccessCloudCard(makeUser('bob', 'FREE', { 'team-1': 'TEAM' }), teamCard)).toBe(true);
    expect(canAccessCloudCard(makeUser('bob', 'PRO'), teamCard)).toBe(false);
    expect(canAccessCloudCard(makeUser('alice', 'PRO', { 'team-1': 'FREE' }), teamCard)).toBe(false);
  });

  it('fails closed when team-folder metadata cannot be resolved', () => {
    expect(canAccessCloudCard(makeUser('alice', 'PRO'), { ownerId: 'alice', teamFolderId: 'missing' })).toBe(false);
  });

  it('rejects a version belonging to another card', () => {
    expect(versionBelongsToCard({ carryCardId: 'card-b' }, 'card-a')).toBe(false);
    expect(versionBelongsToCard({ carryCardId: 'card-a' }, 'card-a')).toBe(true);
    expect(versionBelongsToCard(null, 'card-a')).toBe(false);
  });

  it('enforces read/write scopes separately', () => {
    expect(hasMcpScope(['mcp:read'], 'mcp:read')).toBe(true);
    expect(hasMcpScope(['mcp:read'], 'mcp:write')).toBe(false);
    expect(hasMcpScope(['mcp:write'], 'mcp:read')).toBe(false);
    expect(hasMcpScope([], 'mcp:read')).toBe(false);
  });
});
