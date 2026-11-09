import { db, type LocalCarryCard, type LocalCarryCardVersion } from './db';
export type { LocalCarryCard, LocalCarryCardVersion, SyncStatus } from './db';
import { ConversationNode, SupportedPlatform } from '@convocarry/shared-types';

/** Generates a simple unique ID for local-first creation */
function generateId() {
  return crypto.randomUUID();
}

/** FREE tier limits */
const FREE_TIER_MAX_CARDS = 25;
const FREE_TIER_ALLOWED_PLATFORMS = ['chatgpt', 'claude'];

export class StorageLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageLimitError';
  }
}

export const cardStorage = {
  /** Create a new Carry Card and its initial version */
  async createCard(params: {
    title: string;
    description?: string;
    tags?: string[];
    platform: string;
    contextBody: ConversationNode[];
    sourceAccountLabel?: string;
  }): Promise<{ card: LocalCarryCard; version: LocalCarryCardVersion }> {
    
    // Check limits
    const currentCount = await db.carryCards.count();
    if (currentCount >= FREE_TIER_MAX_CARDS) {
      throw new StorageLimitError(`Free tier limit reached. You can only have ${FREE_TIER_MAX_CARDS} local Carry Cards.`);
    }

    if (!FREE_TIER_ALLOWED_PLATFORMS.includes(params.platform.toLowerCase())) {
      throw new Error(`Platform ${params.platform} is not supported on the local-first free tier.`);
    }

    const cardId = generateId();
    const versionId = generateId();
    const now = new Date();

    const card: LocalCarryCard = {
      id: cardId,
      title: params.title,
      description: params.description,
      tags: params.tags || [],
      currentVersionId: versionId,
      syncStatus: 'local_only',
      createdAt: now,
      updatedAt: now,
    };

    const version: LocalCarryCardVersion = {
      id: versionId,
      carryCardId: cardId,
      platform: params.platform,
      contextBody: params.contextBody,
      sourceAccountLabel: params.sourceAccountLabel,
      syncStatus: 'local_only',
      createdAt: now,
    };

    // Use transaction for consistency
    await db.transaction('rw', db.carryCards, db.carryCardVersions, async () => {
      await db.carryCards.add(card);
      await db.carryCardVersions.add(version);
    });

    return { card, version };
  },

  /** Get a card and its current version */
  async getCardWithCurrentVersion(cardId: string) {
    const card = await db.carryCards.get(cardId);
    if (!card) return null;

    let version = null;
    if (card.currentVersionId) {
      version = await db.carryCardVersions.get(card.currentVersionId);
    }
    
    return { card, version };
  },

  /** List all local carry cards (descending by updated time) */
  async listCards(): Promise<LocalCarryCard[]> {
    return await db.carryCards.orderBy('updatedAt').reverse().toArray();
  },

  /** Search across title, tags, and context body */
  async searchCards(query: string) {
    const q = query.toLowerCase();
    
    // Naive local search: load all and filter in memory for simplicity in MVP.
    // In production with thousands of cards, we'd use full-text search indexing.
    const allCards = await db.carryCards.toArray();
    const matches = [];

    for (const card of allCards) {
      // Check title and tags
      if (card.title.toLowerCase().includes(q) || card.tags.some(t => t.toLowerCase().includes(q))) {
        matches.push(card);
        continue;
      }

      // Check content body if title doesn't match
      if (card.currentVersionId) {
        const version = await db.carryCardVersions.get(card.currentVersionId);
        if (version) {
          const bodyText = version.contextBody.map(n => n.text.toLowerCase()).join(' ');
          if (bodyText.includes(q)) {
            matches.push(card);
          }
        }
      }
    }

    return matches;
  },

  /** Update title/tags */
  async updateCard(cardId: string, updates: Partial<Pick<LocalCarryCard, 'title' | 'description' | 'tags' | 'deletedAt' | 'purgeAfter'>>) {
    const card = await db.carryCards.get(cardId);
    if (!card) throw new Error('Card not found');

    const updateData = { ...updates, updatedAt: new Date() };
    
    // Mark pending sync if it was previously synced
    if (card.syncStatus === 'synced') {
      (updateData as any).syncStatus = 'pending_sync';
    }

    await db.carryCards.update(cardId, updateData);
    return await db.carryCards.get(cardId);
  },

  /** Delete a card and all its versions */
  async deleteCard(cardId: string) {
    await db.transaction('rw', db.carryCards, db.carryCardVersions, async () => {
      // In a cloud scenario, we might soft-delete instead, but for local MVP we hard delete
      await db.carryCardVersions.where('carryCardId').equals(cardId).delete();
      await db.carryCards.delete(cardId);
    });
  },

  /** Create a new version of an existing card */
  async createVersion(
    cardId: string, 
    params: {
      platform: string;
      contextBody: ConversationNode[];
      sourceAccountLabel?: string;
      setAsCurrent?: boolean;
    }
  ) {
    const card = await db.carryCards.get(cardId);
    if (!card) throw new Error('Card not found');

    const versionId = generateId();
    const now = new Date();

    const version: LocalCarryCardVersion = {
      id: versionId,
      carryCardId: cardId,
      parentId: card.currentVersionId,
      platform: params.platform,
      contextBody: params.contextBody,
      sourceAccountLabel: params.sourceAccountLabel,
      syncStatus: 'local_only',
      createdAt: now,
    };

    await db.transaction('rw', db.carryCards, db.carryCardVersions, async () => {
      await db.carryCardVersions.add(version);
      
      if (params.setAsCurrent !== false) {
        const status = card.syncStatus === 'synced' ? 'pending_sync' : card.syncStatus;
        await db.carryCards.update(cardId, { 
          currentVersionId: versionId, 
          updatedAt: now,
          syncStatus: status
        });
      }
    });

    return version;
  },

  /** Change the active/current version pointer */
  async setCurrentVersion(cardId: string, versionId: string) {
    const version = await db.carryCardVersions.get(versionId);
    if (!version || version.carryCardId !== cardId) {
      throw new Error('Version does not belong to this card');
    }
    await db.carryCards.update(cardId, { currentVersionId: versionId, updatedAt: new Date() });
  },

  /** Export all data to JSON */
  async exportJson(): Promise<string> {
    const cards = await db.carryCards.toArray();
    const versions = await db.carryCardVersions.toArray();
    
    return JSON.stringify({
      version: 1,
      timestamp: new Date().toISOString(),
      data: {
        carryCards: cards,
        carryCardVersions: versions,
      }
    }, null, 2);
  },

  /** Import data from JSON */
  async importJson(jsonString: string): Promise<void> {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.data || !parsed.data.carryCards) throw new Error('Invalid export format');

      const { carryCards, carryCardVersions } = parsed.data;

      // Note: We blindly import and trust the structure for this MVP utility.
      // In a real scenario, run Zod validation here.
      await db.transaction('rw', db.carryCards, db.carryCardVersions, async () => {
        for (const card of carryCards) {
          await db.carryCards.put(card); // put overrides/updates
        }
        if (carryCardVersions) {
          for (const v of carryCardVersions) {
            await db.carryCardVersions.put(v);
          }
        }
      });
    } catch (e) {
      throw new Error('Failed to import JSON: ' + (e as Error).message);
    }
  }
};
