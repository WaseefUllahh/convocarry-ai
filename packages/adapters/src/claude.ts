import { insertConversationText } from './insertion';
import { SiteAdapter, ConversationNode } from '@convocarry/shared-types';
import { safeTextFromElement, createConversationNode } from './helpers';

const DEBUG = false;

function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log('[ConvoCarry Claude Adapter]', ...args);
  }
}

export const claudeAdapter: SiteAdapter = {
  id: 'claude-v2',
  platform: 'claude',
  
  matchesUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && ['claude.ai'].includes(parsed.hostname);
    } catch { return false; }
  },
  
  async extractConversation(root: Document | Element = document, url?: string): Promise<ConversationNode[]> {
    debugLog('Starting extraction...');
    const nodes: ConversationNode[] = [];
    
    const messageElements = root.querySelectorAll('.font-user-message, .font-claude-message');
    
    if (messageElements.length === 0) {
      debugLog('No message elements found with Claude marker classes.');
      throw new Error('Could not find conversation messages. The page structure may have changed.');
    }

    const currentUrl = url || window.location.href;
    const timestamp = new Date().toISOString();

    messageElements.forEach(el => {
      const isUser = el.classList.contains('font-user-message');
      const role = isUser ? 'user' : 'assistant';
      
      const text = safeTextFromElement(el);
      
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
    const composer = root.querySelector('div[contenteditable="true"]') as HTMLElement;
    return composer || null;
  },

  async insertText(target: HTMLElement, text: string): Promise<void> {
    const result = insertConversationText(text, 'claude', undefined, target);
    if (!result.ok) throw new Error(result.error);
  },

  async getActiveAccountLabel(root: Document | Element = document): Promise<string | null> {
    debugLog('Attempting to extract active account label...');
    try {
      const profileButton = root.querySelector('button[aria-label*="Profile"], button[aria-label*="Account"], .bg-bg-000');
      
      if (profileButton) {
        const ariaLabel = profileButton.getAttribute('aria-label');
        if (ariaLabel && !ariaLabel.toLowerCase().includes('button')) {
          return ariaLabel.replace(/profile|account/ig, '').trim();
        }
        
        const text = safeTextFromElement(profileButton);
        if (text && text.length > 0 && text.length < 50) return text;
      }
      
      const sidebarNav = root.querySelector('nav');
      if (sidebarNav) {
        const textNodes = Array.from(sidebarNav.querySelectorAll('*'))
          .map(el => el.textContent || '')
          .filter(t => t.includes('@'));
          
        if (textNodes.length > 0) {
          return textNodes[0].trim();
        }
      }

      return null;
    } catch (e) {
      debugLog('Error extracting account label:', e);
      return null; 
    }
  }
};
