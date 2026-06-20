import { ConversationNode } from '@convocarry/shared-types';

export function normalizeWhitespace(text: string): string {
  return text.replace(/[\r\n]+/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

export function safeTextFromElement(element: Element | null): string {
  if (!element) return '';
  // Avoid scripts/styles
  const clone = element.cloneNode(true) as Element;
  const badTags = clone.querySelectorAll('script, style, button, svg');
  badTags.forEach(el => el.remove());
  return normalizeWhitespace(clone.textContent || '');
}

export function sanitizeForInjection(text: string): string {
  // Strip any accidental HTML tags just to be safe
  const doc = new DOMParser().parseFromString(text, 'text/html');
  return doc.body.textContent || '';
}

export function createConversationNode(
  role: 'user' | 'assistant' | 'system' | 'unknown',
  text: string,
  metadata?: Partial<ConversationNode>
): ConversationNode {
  return {
    role,
    text,
    ...metadata,
  };
}
