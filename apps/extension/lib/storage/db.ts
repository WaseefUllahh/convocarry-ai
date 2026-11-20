import Dexie, { Table } from 'dexie';
import { ConversationNode } from '@convocarry/shared-types';

export type SyncStatus = 'local_only' | 'synced' | 'pending_sync' | 'sync_error';

export interface LocalCarryCard {
  id: string; // Typically a UUID or CUID
  title: string;
  description?: string;
  tags: string[];
  
  ownerId?: string; // Null if local-only/free tier
  teamFolderId?: string;
  currentVersionId?: string;
  
  syncStatus: SyncStatus;
  lastSyncAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  purgeAfter?: Date;
}

export interface LocalCarryCardVersion {
  id: string;
  carryCardId: string;
  parentId?: string;
  
  contextBody: ConversationNode[];
  rawSnapshot?: ConversationNode[];
  sourceAccountLabel?: string;
  platform: string;
  
  syncStatus: SyncStatus;
  lastSyncAt?: Date;
  
  createdAt: Date;
}

export interface LocalAttachmentMetadata {
  id: string;
  versionId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  syncStatus: SyncStatus;
}

export interface LocalSetting {
  key: string;
  value: any;
}

export interface LocalUsageEvent {
  id: string;
  eventType: string;
  timestamp: Date;
  metadata?: any;
}

export class ConvoCarryDatabase extends Dexie {
  carryCards!: Table<LocalCarryCard, string>;
  carryCardVersions!: Table<LocalCarryCardVersion, string>;
  attachmentsMetadata!: Table<LocalAttachmentMetadata, string>;
  settings!: Table<LocalSetting, string>;
  usage!: Table<LocalUsageEvent, string>;

  constructor() {
    super('ConvoCarryLocalDB');
    
    // Define indices for searching and relation lookups
    this.version(2).stores({
      carryCards: 'id, title, syncStatus, deletedAt, createdAt',
      carryCardVersions: 'id, carryCardId, parentId, syncStatus',
      attachmentsMetadata: 'id, versionId',
      settings: 'key',
      usage: 'id, eventType, timestamp'
    });
    // Add the index used by listCards without deleting existing cards or versions.
    this.version(3).stores({ carryCards: 'id, title, syncStatus, deletedAt, createdAt, updatedAt' });
  }
}

export const db = new ConvoCarryDatabase();
