import { beforeEach, describe, expect, it } from 'vitest';
import { insertConversationText } from '../src/insertion';
import { getAdapterForUrl } from '../src/registry';

beforeEach(() => { document.body.innerHTML = '<textarea id="prompt-textarea"></textarea>'; });

describe('Verified insertion', () => {
  it('returns failure if the composer is missing', () => {
    document.body.innerHTML = '';
    expect(insertConversationText('context', 'chatgpt')).toMatchObject({ ok: false, error: expect.stringContaining('Composer not found') });
  });
  it('preserves an existing draft', () => {
    const target = document.querySelector('textarea')!;
    target.value = 'My unsent question';
    expect(insertConversationText('context', 'chatgpt').ok).toBe(false);
    expect(target.value).toBe('My unsent question');
  });
  it('refuses a changed destination', () => {
    expect(insertConversationText('context', 'chatgpt', 'https://chatgpt.com/c/old').ok).toBe(false);
    expect(document.querySelector('textarea')!.value).toBe('');
  });
  it('does not claim success for unsupported pages or a disabled composer', () => {
    expect(insertConversationText('context', 'unsupported').ok).toBe(false);
    document.querySelector('textarea')!.disabled = true;
    expect(insertConversationText('context', 'chatgpt').ok).toBe(false);
  });
  it.each(['https://chatgpt.com.evil.test', 'https://example.test/?next=https://claude.ai', 'http://chatgpt.com', 'not-a-url'])('rejects lookalike or invalid URL %s', url => {
    expect(getAdapterForUrl(url).id).toBe('unsupported-fallback');
  });
});
