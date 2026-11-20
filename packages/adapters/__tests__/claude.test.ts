import { describe, it, expect, beforeEach, vi } from 'vitest';
import { claudeAdapter } from '../src/claude';

describe('Claude Adapter Advanced Insertion', () => {
  beforeEach(() => {
    // Setup mock Claude DOM
    document.body.innerHTML = `
      <div id="claude-app">
        <div class="font-user-message">User message test</div>
        <div class="font-claude-message">Claude message test</div>
        <div contenteditable="true" id="composer"></div>
        <nav>
          <button aria-label="Test User Account">Profile Settings</button>
        </nav>
      </div>
    `;
    
    // Mock document.execCommand for testing
    document.execCommand = vi.fn().mockImplementation((commandId, showUI, value) => {
      if (commandId === 'insertText') {
        const composer = document.getElementById('composer');
        if (composer) {
          composer.textContent = value;
          return true; // Simulate success
        }
      }
      return false;
    });
  });

  it('detects claude.ai URL', () => {
    expect(claudeAdapter.matchesUrl('https://claude.ai/chat/123')).toBe(true);
    expect(claudeAdapter.matchesUrl('https://chatgpt.com')).toBe(false);
  });

  it('extracts messages safely', async () => {
    const nodes = await claudeAdapter.extractConversation();
    expect(nodes.length).toBe(2);
    expect(nodes[0].role).toBe('user');
    expect(nodes[0].text).toBe('User message test');
    expect(nodes[1].role).toBe('assistant');
    expect(nodes[1].text).toBe('Claude message test');
    expect(nodes[0].timestamp).toBeDefined();
    expect(nodes[0].sourceUrl).toBe('http://localhost:3000/'); // default jsdom URL
  });

  it('extracts account label from aria-label', async () => {
    const label = await claudeAdapter.getActiveAccountLabel();
    expect(label).toBe('Test User');
  });

  it('inserts text using execCommand on contenteditable', async () => {
    const target = claudeAdapter.getComposerInput();
    expect(target).not.toBeNull();

    const dispatchSpy = vi.spyOn(target!, 'dispatchEvent');
    
    await claudeAdapter.insertText(target!, 'Testing Claude Injection');
    
    expect(document.execCommand).toHaveBeenCalledWith('insertText', false, 'Testing Claude Injection');
    expect(target!.textContent).toBe('Testing Claude Injection');
    expect(dispatchSpy).toHaveBeenCalled(); // Should have fired 'input' event
  });

  it('falls back to inert text if execCommand fails', async () => {
    const target = claudeAdapter.getComposerInput();
    
    // Mock execCommand to fail
    document.execCommand = vi.fn().mockReturnValue(false);
    
    const dispatchSpy = vi.spyOn(target!, 'dispatchEvent');
    
    await claudeAdapter.insertText(target!, 'Synthetic Paste Test');
    
    expect(target!.textContent).toBe('Synthetic Paste Test');
    const events = dispatchSpy.mock.calls.map(call => call[0].type);
    expect(events).toContain('input');
  });

  it('prevents HTML injection', async () => {
    const target = claudeAdapter.getComposerInput();
    await claudeAdapter.insertText(target!, '<script>alert(1)</script>');
    
    expect(target!.textContent).toBe('<script>alert(1)</script>');
    expect(target!.querySelector('script')).toBeNull();
  });
});
