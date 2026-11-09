import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chatgptAdapter } from '../src/chatgpt';
import { claudeAdapter } from '../src/claude';
import fs from 'fs';
import path from 'path';

describe('Adapter Insertion', () => {
  beforeEach(() => {
    const html = fs.readFileSync(path.resolve(__dirname, './fixtures/mock-dom.html'), 'utf-8');
    document.documentElement.innerHTML = html;
  });

  it('inserts text into textarea (ChatGPT)', async () => {
    document.body.innerHTML = document.getElementById('chatgpt-mock')!.outerHTML;
    const target = chatgptAdapter.getComposerInput() as HTMLTextAreaElement;
    expect(target).not.toBeNull();

    // Mock dispatchEvent to spy on it
    const spy = vi.spyOn(target, 'dispatchEvent');
    
    await chatgptAdapter.insertText(target, 'Injected context');
    
    expect(target.value).toBe('Injected context');
    expect(spy).toHaveBeenCalled();
  });

  it('inserts text into contenteditable (Claude)', async () => {
    document.body.innerHTML = document.getElementById('claude-mock')!.outerHTML;
    const target = claudeAdapter.getComposerInput();
    expect(target).not.toBeNull();

    const spy = vi.spyOn(target!, 'dispatchEvent');
    
    await claudeAdapter.insertText(target!, 'Injected context');
    
    expect(target!.textContent).toBe('Injected context');
    expect(spy).toHaveBeenCalled();
  });

  it('keeps HTML code as inert text during injection', async () => {
    document.body.innerHTML = document.getElementById('chatgpt-mock')!.outerHTML;
    const target = chatgptAdapter.getComposerInput() as HTMLTextAreaElement;
    
    await chatgptAdapter.insertText(target, '<b>Bold</b> and <script>alert(1)</script>');
    
    expect(target.value).toBe('<b>Bold</b> and <script>alert(1)</script>');
    expect(document.querySelector('script')).toBeNull();
  });
});
