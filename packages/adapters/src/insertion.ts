export type PageInsertionResult = { ok: true } | { ok: false; error: string };

/** Self-contained: Chrome serializes this function into the active tab. */
export function insertConversationText(
  text: string,
  platform: string,
  expectedUrl?: string,
  targetOverride?: HTMLElement,
): PageInsertionResult {
  if (platform !== 'chatgpt' && platform !== 'claude') {
    return { ok: false, error: 'Open ChatGPT or Claude before inserting a Carry Card.' };
  }
  if (expectedUrl && window.location.href !== expectedUrl) {
    return { ok: false, error: 'The destination page changed. Open the extension again and retry.' };
  }
  const target = targetOverride || document.querySelector<HTMLElement>(platform === 'chatgpt'
    ? '#prompt-textarea, div[contenteditable="true"].ProseMirror'
    : 'div[contenteditable="true"]');
  if (!target) return { ok: false, error: 'Composer not found. Wait for the chat to load and try again.' };
  const textarea = target.tagName.toLowerCase() === 'textarea' ? target as HTMLTextAreaElement : null;
  if (!textarea && target.getAttribute('contenteditable') !== 'true') {
    return { ok: false, error: 'This composer is not editable.' };
  }
  if (textarea?.disabled || textarea?.readOnly) return { ok: false, error: 'The composer is currently disabled.' };
  if ((textarea ? textarea.value : target.textContent || '').trim()) {
    return { ok: false, error: 'The composer already contains a draft. Save or clear it before inserting a Carry Card.' };
  }
  target.focus();
  if (textarea) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(textarea, text);
    else textarea.value = text;
  } else {
    // With normal HTML whitespace, Chromium's native editing command substitutes
    // nonbreaking spaces for indentation. Keep code whitespace literal instead.
    target.style.whiteSpace = 'pre-wrap';
    const range = document.createRange();
    range.selectNodeContents(target);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    let inserted = false;
    try { inserted = document.execCommand('insertText', false, text); } catch { /* Use a text-only fallback. */ }
    if (!inserted) target.textContent = text;
  }
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
  // innerText preserves line breaks that rich-text editors represent with block elements.
  const actual = textarea ? textarea.value : (target.innerText || target.textContent || '');
  if (actual.replace(/\r\n/g, '\n') !== text.replace(/\r\n/g, '\n')) {
    return { ok: false, error: 'The composer did not accept the complete text. Use Copy from the dashboard.' };
  }
  return { ok: true };
}
