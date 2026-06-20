import type { ConversationNode } from '@convocarry/shared-types';

/** Interface that all site adapters must implement */
export interface SiteAdapter {
  /** Unique identifier for this adapter */
  id: string;

  /** Human-readable name */
  name: string;

  /** URL patterns this adapter handles (matched against window.location.href) */
  urlPatterns: RegExp[];

  /** Adapter version — bumped when selectors change */
  version: string;

  /**
   * Extract conversation messages from the current page DOM.
   * Called inside a content script context (has DOM access).
   */
  extract(): ConversationNode[];

  /**
   * Inject text content into the chat input field.
   * Called inside a content script context (has DOM access).
   * Returns true if injection was successful.
   */
  inject(text: string): boolean;

  /**
   * Check if this adapter can handle the current page.
   * More specific than URL matching — can check for DOM elements.
   */
  canHandle(): boolean;
}

/** Result of an extraction attempt */
export interface ExtractionResult {
  success: boolean;
  content?: ConversationNode[];
  error?: string;
  messageCount?: number;
}

/** Result of an injection attempt */
export interface InjectionResult {
  success: boolean;
  error?: string;
}
