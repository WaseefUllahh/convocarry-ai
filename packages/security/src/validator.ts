/**
 * Input Validator
 *
 * Validates and constrains input data before processing.
 * Uses schema validation to enforce data shape and size limits.
 *
 * Implementation will use Zod for schema validation.
 *
 * Implementation pending — this is a scaffold.
 */

/** Maximum size of a single Carry Card content in bytes */
export const MAX_CARD_SIZE_BYTES = 512_000; // 500 KB

/** Maximum number of messages in a single card */
export const MAX_MESSAGES_PER_CARD = 500;

/** Maximum length of a card title */
export const MAX_TITLE_LENGTH = 200;

/** Maximum number of tags per card */
export const MAX_TAGS_PER_CARD = 20;

/** Validate card title */
export function isValidTitle(_title: string): boolean {
  // TODO: Implement with Zod
  return typeof _title === 'string' && _title.length > 0 && _title.length <= MAX_TITLE_LENGTH;
}

/** Validate card content size */
export function isValidCardSize(_content: unknown): boolean {
  // TODO: Implement size check
  return true;
}
