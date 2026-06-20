import { describe, it, expect, beforeEach } from 'vitest';
import { chatgptAdapter } from '../src/chatgpt';
import { claudeAdapter } from '../src/claude';
import fs from 'fs';
import path from 'path';

describe('Adapter Extraction', () => {
  beforeEach(() => {
    const html = fs.readFileSync(path.resolve(__dirname, './fixtures/mock-dom.html'), 'utf-8');
    document.documentElement.innerHTML = html;
  });

  it('extracts ChatGPT conversation', async () => {
    // Isolate ChatGPT mock
    document.body.innerHTML = document.getElementById('chatgpt-mock')!.outerHTML;
    
    const nodes = await chatgptAdapter.extractConversation();
    expect(nodes.length).toBe(2);
    expect(nodes[0].role).toBe('user');
    expect(nodes[0].text).toBe('Hello, ChatGPT!');
    expect(nodes[1].role).toBe('assistant');
    expect(nodes[1].text).toBe('Hello! How can I help you?');
  });

  it('extracts Claude conversation', async () => {
    // Isolate Claude mock
    document.body.innerHTML = document.getElementById('claude-mock')!.outerHTML;
    
    const nodes = await claudeAdapter.extractConversation();
    expect(nodes.length).toBe(2);
    expect(nodes[0].role).toBe('user');
    expect(nodes[0].text).toBe('Can you explain adapters?');
    expect(nodes[1].role).toBe('assistant');
    expect(nodes[1].text).toBe('An adapter is a structural design pattern...');
  });

  it('fails gracefully when no elements found', async () => {
    document.body.innerHTML = '<div>Empty DOM</div>';
    await expect(chatgptAdapter.extractConversation()).rejects.toThrow('Could not find conversation messages');
  });
});
