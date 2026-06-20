import { SiteAdapter, ConversationNode } from '@convocarry/shared-types';
import { safeTextFromElement, createConversationNode, sanitizeForInjection } from './helpers';

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
    return url.includes('chatgpt.com') || url.includes('chat.openai.com');
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
    const cleanText = sanitizeForInjection(text);
    debugLog('Injecting text into composer', target);
    
    if (target.tagName.toLowerCase() === 'textarea') {
      const textarea = target as HTMLTextAreaElement;
      
      // React heavily controls the value of textareas. Bypassing the getter/setter ensures it registers.
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(textarea, cleanText);
      } else {
        textarea.value = cleanText;
      }
      
      // Fire events so React updates its state
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      
    } else if (target.getAttribute('contenteditable') === 'true') {
      target.textContent = cleanText;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      throw new Error('Target is neither a textarea nor contenteditable.');
    }
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
