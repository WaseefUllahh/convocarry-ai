import { db, LocalCarryCard, LocalCarryCardVersion } from './db';
import { ConversationNode } from '@convocarry/shared-types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.convocarry.ai/api/v1';

export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncError';
  }
}

export const syncEngine = {
  async getAuthToken(): Promise<string | null> {
    // 1. Check if we already have a valid ConvoCarry session JWT cached
    const cached = await db.settings.get('sessionJwt');
    const cachedExpires = await db.settings.get('sessionJwtExpires');
    if (cached && cachedExpires && new Date(cachedExpires.value) > new Date()) {
      return cached.value;
    }

    // 2. Fetch Google OAuth Token
    const googleToken = await new Promise<string | null>((resolve) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        resolve(token || null);
      });
    });

    if (!googleToken) return null;

    // 3. Exchange for ConvoCarry JWT
    const response = await fetch(`${API_BASE_URL}/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: googleToken })
    });

    if (!response.ok) {
      if (response.status === 401) chrome.identity.removeCachedAuthToken({ token: googleToken }, () => {});
      throw new SyncError('Failed to exchange auth token');
    }

    const data = await response.json();
    
    // Cache the JWT
    await db.settings.put({ key: 'sessionJwt', value: data.token });
    // Assume 7 day expiry for cache as a buffer
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 6);
    await db.settings.put({ key: 'sessionJwtExpires', value: expiry.toISOString() });

    return data.token;
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
    if (!token) throw new SyncError('Not authenticated');

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
    if (!token) throw new SyncError('Not authenticated');

    const lastSync = await this.getLastSyncTimestamp();
    let totalPulled = 0;
    let cursor: string | null = null;
    let hasMore = true;
    let highestTimestamp = lastSync ? lastSync.getTime() : 0;

    while (hasMore) {
      const response = await fetch(`${API_BASE_URL}/sync/pull`, {
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

      const { timestamp, data, nextCursor, hasMore: _hasMore } = await response.json();
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
