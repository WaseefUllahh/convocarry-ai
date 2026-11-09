import { db, LocalCarryCard, LocalCarryCardVersion } from './db';
import { ConversationNode } from '@convocarry/shared-types';

import { API_BASE_URL } from '../api/config';
import { auth } from '../auth';

export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncError';
  }
}

export const syncEngine = {
  async getAuthToken(): Promise<string | null> {
    return (await auth.getSession())?.token || null;
  },

  async getLastSyncTimestamp(): Promise<Date | null> {
    const setting = await db.settings.get('lastSyncTimestamp');
    return setting?.value ? new Date(setting.value) : null;
  },

  async setLastSyncTimestamp(date: Date): Promise<void> {
    await db.settings.put({ key: 'lastSyncTimestamp', value: date.toISOString() });
  },

  async push(): Promise<number> {
    const token = await this.getAuthToken();
    if (!token) throw new SyncError('Sign in from the extension popup before syncing.');

    let totalUpdated = 0;
    const MAX_RETRIES = 10;
    let purgedFound = 0;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const cardsToPush = await db.carryCards.where('syncStatus').anyOf('local_only', 'pending_sync', 'sync_error').toArray();
      const versionsToPush = await db.carryCardVersions.where('syncStatus').anyOf('local_only', 'pending_sync', 'sync_error').toArray();

      if (cardsToPush.length === 0 && versionsToPush.length === 0) return totalUpdated;

      let chunkSuccess = true;
      const CHUNK_SIZE = 25;
      
      for (let i = 0; i < Math.max(cardsToPush.length, versionsToPush.length); i += CHUNK_SIZE) {
        const cardChunk = cardsToPush.slice(i, i + CHUNK_SIZE);
        const versionChunk = versionsToPush.slice(i, i + CHUNK_SIZE);

        if (cardChunk.length === 0 && versionChunk.length === 0) break;

        const response = await fetch(`${API_BASE_URL}/sync/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            cards: cardChunk,
            versions: versionChunk
          })
        });

        if (!response.ok) {
          if (response.status === 403) throw new SyncError('Requires Pro or Team subscription to sync.');
          
          if (response.status === 410) {
            const errData = await response.json().catch(() => ({}));
            if (errData.errorCode === 'CARD_PURGED' && errData.cardId) {
              purgedFound++;
              // Hard-delete the local zombie card
              await db.transaction('rw', db.carryCards, db.carryCardVersions, async () => {
                await db.carryCards.delete(errData.cardId);
                await db.carryCardVersions.where('carryCardId').equals(errData.cardId).delete();
              });
              
              chunkSuccess = false;
              break; // Break chunk loop, restart from top of the retry loop
            }
          }

          throw new SyncError('Failed to push sync payload chunk');
        }

        const result = await response.json();
        if (Array.isArray(result.errors) && result.errors.length > 0) {
          throw new SyncError(`Server rejected ${result.errors.length} sync item(s): ${String(result.errors[0])}`);
        }
        totalUpdated += result.cardsUpdated + result.versionsAdded;

        // Mark chunk as synced or execute hard delete for soft-deleted cards
        await db.transaction('rw', db.carryCards, db.carryCardVersions, async () => {
          for (const c of cardChunk) {
            if (c.deletedAt) {
              await db.carryCards.delete(c.id);
              await db.carryCardVersions.where('carryCardId').equals(c.id).delete();
            } else {
              await db.carryCards.update(c.id, { syncStatus: 'synced' });
            }
          }
          for (const v of versionChunk) {
            await db.carryCardVersions.update(v.id, { syncStatus: 'synced' });
          }
        });
      }

      if (chunkSuccess) {
        return totalUpdated;
      }
    }

    if (purgedFound >= MAX_RETRIES) {
      throw new SyncError('Too many purged cards encountered. Sync aborted to protect data integrity.');
    }

    return totalUpdated;
  },

  async pull(): Promise<number> {
    const token = await this.getAuthToken();
    if (!token) throw new SyncError('Sign in from the extension popup before syncing.');

    const lastSync = await this.getLastSyncTimestamp();
    let totalPulled = 0;
    let cursor: string | null = null;
    let hasMore = true;
    let highestTimestamp = lastSync ? lastSync.getTime() : 0;

    while (hasMore) {
      const response: Response = await fetch(`${API_BASE_URL}/sync/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          lastSyncTimestamp: lastSync?.toISOString() || null,
          limit: 50,
          cursor
        })
      });

      if (!response.ok) {
        if (response.status === 403) throw new SyncError('Requires Pro or Team subscription to sync.');
        throw new SyncError('Failed to pull sync payload');
      }

      const { timestamp, data, nextCursor, hasMore: _hasMore }: { timestamp: string; data: { cards?: any[]; versions?: any[] }; nextCursor: string | null; hasMore: boolean } = await response.json();
      hasMore = _hasMore;
      cursor = nextCursor;

      const pullTimestamp = new Date(timestamp).getTime();
      if (pullTimestamp > highestTimestamp) {
        highestTimestamp = pullTimestamp;
      }

      await db.transaction('rw', db.carryCards, db.carryCardVersions, async () => {
        if (data.cards) {
          for (const c of data.cards) {
            c.syncStatus = 'synced';
            c.createdAt = new Date(c.createdAt);
            c.updatedAt = new Date(c.updatedAt);
            if (c.deletedAt) c.deletedAt = new Date(c.deletedAt);
            if (c.purgeAfter) c.purgeAfter = new Date(c.purgeAfter);
            await db.carryCards.put(c);
          }
          totalPulled += data.cards.length;
        }
        if (data.versions) {
          for (const v of data.versions) {
            v.syncStatus = 'synced';
            v.createdAt = new Date(v.createdAt);
            await db.carryCardVersions.put(v);
          }
          totalPulled += data.versions.length;
        }
      });
    }

    await this.setLastSyncTimestamp(new Date(highestTimestamp));
    return totalPulled;
  },

  /** Full Sync Cycle */
  async syncAll(): Promise<void> {
    try {
      await this.pull();
      await this.push();
      await this.pull();
    } catch (e) {
      console.error('Sync cycle failed:', e);
      throw e;
    }
  }
};
