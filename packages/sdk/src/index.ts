/**
 * @convocarry/sdk
 *
 * Public SDK for ConvoCarry AI.
 * Provides a typed API client for third-party integrations.
 *
 * Usage (planned):
 *
 * ```typescript
 * import { ConvoCarryClient } from '@convocarry/sdk';
 *
 * const client = new ConvoCarryClient({ apiKey: 'your-api-key' });
 * const cards = await client.cards.list();
 * ```
 */

export * from './client';

// Re-export commonly used types from shared-types
export type {
  CarryCard,
  CarryCardVersion,
  ConversationNode,
  InjectPayload,
} from '@convocarry/shared-types';
