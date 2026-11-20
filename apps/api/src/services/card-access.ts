import type { AuthenticatedUser } from '../plugins/auth';

/**
 * Shared authorization check for cloud-backed Carry Cards.
 * Personal cards belong only to their owner. Team cards require both
 * active team entitlement and membership in the card's actual team.
 */
export function canAccessCloudCard(
  user: Pick<AuthenticatedUser, 'id' | 'teams' | 'getEffectivePlan'>,
  card: { ownerId: string; teamFolderId?: string | null; teamFolder?: { teamId: string } | null }
): boolean {
  if (card.teamFolderId) {
    const teamId = card.teamFolder?.teamId;
    return Boolean(teamId && user.teams.includes(teamId) && user.getEffectivePlan(teamId) === 'TEAM');
  }
  return card.ownerId === user.id && ['PRO', 'TEAM'].includes(user.getEffectivePlan());
}

/** Reject cross-card version references even when an ID is otherwise valid. */
export function versionBelongsToCard(
  version: { carryCardId: string } | null | undefined,
  cardId: string
): boolean {
  return version?.carryCardId === cardId;
}

/** MCP keys must explicitly grant each action's read or write permission. */
export function hasMcpScope(
  scopes: readonly string[],
  required: 'mcp:read' | 'mcp:write'
): boolean {
  return scopes.includes(required);
}
