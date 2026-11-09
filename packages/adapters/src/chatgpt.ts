import { insertConversationText } from './insertion';
import { SiteAdapter, ConversationNode } from '@convocarry/shared-types';
import { safeTextFromElement, createConversationNode } from './helpers';

const DEBUG = false;

function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log('[ConvoCarry ChatGPT Adapter]', ...args);
  }
}

export const chatgptAdapter: SiteAdapter = {
  id: 'chatgpt-v2',
  platform: 'chatgpt',
  
  matchesUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && ['chatgpt.com', 'chat.openai.com'].includes(parsed.hostname);
    } catch { return false; }
  },
  
  async extractConversation(root: Document | Element = document, url?: string): Promise<ConversationNode[]> {
    debugLog('Starting extraction...');
    const nodes: ConversationNode[] = [];
    const messageElements = root.querySelectorAll('[data-message-author-role]');
    
    if (messageElements.length === 0) {
      debugLog('No message elements found with data-message-author-role.');
      throw new Error('Could not find conversation messages. The page structure may have changed.');
    }

    const currentUrl = url || window.location.href;
    const timestamp = new Date().toISOString();

    messageElements.forEach(el => {
      const roleAttr = el.getAttribute('data-message-author-role');
      const role = roleAttr === 'user' ? 'user' : roleAttr === 'assistant' ? 'assistant' : 'unknown';
      
      const contentEl = el.querySelector('.markdown, [data-message-author-role] > div');
      const text = safeTextFromElement(contentEl || el);
      
      if (text) {
        nodes.push(createConversationNode(role, text, {
          sourceUrl: currentUrl,
          timestamp,
        }));
      }
    });

    debugLog(`Extracted ${nodes.length} messages.`);
    return nodes;
  },

  getComposerInput(root: Document | Element = document): HTMLElement | null {
    // Attempt textarea first (standard)
    let composer = root.querySelector('#prompt-textarea') as HTMLElement;
    if (composer) return composer;

    // Fallback to ProseMirror / contenteditable if textarea is missing
    composer = root.querySelector('div[contenteditable="true"].ProseMirror') as HTMLElement;
    return composer || null;
  },

  async insertText(target: HTMLElement, text: string): Promise<void> {
    const result = insertConversationText(text, 'chatgpt', undefined, target);
    if (!result.ok) throw new Error(result.error);
  },

  async getActiveAccountLabel(root: Document | Element = document): Promise<string | null> {
    debugLog('Attempting to extract active account label...');
    try {
      const profileButton = root.querySelector('button[aria-label*="Profile"], [data-testid="profile-button"], [aria-label*="Account"]');
      
      if (profileButton) {
        const ariaLabel = profileButton.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.toLowerCase() !== 'profile') {
          return ariaLabel.replace(/profile|account/ig, '').trim();
        }
        const text = safeTextFromElement(profileButton);
        if (text) return text;
      }

      const sidebarNav = root.querySelector('nav');
      if (sidebarNav) {
        const elements = Array.from(sidebarNav.querySelectorAll('button, div[role="button"]'));
        const lastEl = elements[elements.length - 1];
        if (lastEl) {
          const text = safeTextFromElement(lastEl);
          if (text && text.length > 0 && text.length < 50) return text;
        }
      }

      return null;
    } catch (e) {
      debugLog('Error extracting account label:', e);
      return null;
    }
  }
};
