export type SupportedPlatform = 'chatgpt' | 'claude' | 'gemini' | 'perplexity' | 'copilot';

export type InjectionMode = 'summary' | 'full_continuation';

export interface User {
  id: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  plan: 'FREE' | 'PRO' | 'TEAM';
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  storageUrl: string;
  createdAt: Date;
}

export interface ConversationNode {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'unknown';
  text: string;
  timestamp?: string;
  attachments?: Attachment[];
  sourceUrl?: string;
}

export interface CarryCardVersion {
  id: string;
  carryCardId: string;
  parentId?: string | null;
  contextBody: ConversationNode[];
  rawSnapshot?: unknown | null;
  sourceAccountLabel?: string | null;
  platform: SupportedPlatform | string;
  attachments?: Attachment[];
  createdAt: Date;
}

export interface CarryCard {
  id: string;
  ownerId: string;
  title: string;
  description?: string | null;
  tags: string[];
  teamFolderId?: string | null;
  currentVersionId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CarryCardShare {
  id: string;
  cardId: string;
  sharedBy: string;
  token: string;
  shortCode: string;
  targetEmail?: string | null;
  expiresAt?: Date | null;
  maxClaims?: number | null;
  claimCount: number;
  createdAt: Date;
}

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyHash: string;
  lastUsedAt?: Date | null;
  expiresAt?: Date | null;
  createdAt: Date;
}

export interface SiteAdapter {
  id: string;
  platform: SupportedPlatform | string;
  matchesUrl(url: string): boolean;
  extractConversation(root?: Document | Element, currentUrl?: string): Promise<ConversationNode[]>;
  getComposerInput(root?: Document | Element): HTMLElement | null;
  insertText(target: HTMLElement, text: string): Promise<void>;
  getActiveAccountLabel(root?: Document | Element): Promise<string | null>;
}
