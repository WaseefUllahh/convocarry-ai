import { ConversationNode } from '@convocarry/shared-types';

export function normalizeWhitespace(text: string): string {
  return text.replace(/[\r\n]+/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

export function safeTextFromElement(element: Element | null): string {
  if (!element) return '';
  const blockTags = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'TR']);
  const read = (node: Node): string => {
    if (node.nodeType === 3) return node.textContent || '';
    if (node.nodeType !== 1) return '';
    const el = node as Element;
    if (['SCRIPT', 'STYLE', 'BUTTON', 'SVG'].includes(el.tagName) || el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return '';
    if (el.tagName === 'BR') return '\n';
    if (el.tagName === 'PRE') {
      const code = el.querySelector('code') || el;
      const language = Array.from(code.classList).find(name => name.startsWith('language-'))?.slice(9) || '';
      const content = code.textContent || '';
      const runs = content.match(/`{3,}/g) || [];
      const fence = '`'.repeat(Math.max(3, ...runs.map(run => run.length + 1)));
      return `\n${fence}${language}\n${content.replace(/\n$/, '')}\n${fence}\n`;
    }
    const text = Array.from(el.childNodes).map(read).join('');
    if (el.tagName === 'CODE') return '`' + text + '`';
    return blockTags.has(el.tagName) ? `\n${text}\n` : text;
  };
  return read(element).trim();
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
