import { SiteAdapter, ConversationNode } from '@convocarry/shared-types';

export const fallbackAdapter: SiteAdapter = {
  id: 'unsupported-fallback',
  platform: 'unsupported',
  matchesUrl(): boolean {
    return true; // Catch-all
  },
  async extractConversation(_root?: Document | Element): Promise<ConversationNode[]> {
    throw new Error('Extraction is not supported on this page.');
  },
  getComposerInput(_root?: Document | Element): HTMLElement | null {
    return null;
  },
  async insertText(): Promise<void> {
    throw new Error('Injection is not supported on this page.');
  },
  async getActiveAccountLabel(_root?: Document | Element): Promise<string | null> {
    return null;
  }
};
