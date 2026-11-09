import { beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { db, ConvoCarryDatabase } from '../lib/storage/db';
import { cardStorage } from '../lib/storage/cards';
import { generateInjectionText, generateStructuredSummary } from '../lib/heuristics';
import { chatgptAdapter } from '@convocarry/adapters';
import type { ConversationNode } from '@convocarry/shared-types';

const transcript: ConversationNode[] = [
  { role: 'user', text: 'Keep the API local.\nUse Python.' },
  { role: 'assistant', text: '```python\nif count < 3:\n    print("<b>literal</b>")\n```' },
  { role: 'user', text: 'Next, add retries.' },
];

beforeEach(async () => {
  await db.open();
  await Promise.all([db.carryCards.clear(), db.carryCardVersions.clear(), db.settings.clear()]);
});

describe('Capture, save, reload and continue', () => {
  it('retains the ordered transcript independently of the summary', async () => {
    const summary = generateStructuredSummary('chatgpt', null, transcript);
    const { card } = await cardStorage.createCard({ title: 'Local API', platform: 'chatgpt', contextBody: summary, rawSnapshot: transcript });
    db.close();
    await db.open();
    const saved = await cardStorage.getCardWithCurrentVersion(card.id);
    expect(saved?.version?.rawSnapshot).toEqual(transcript);
    expect(await cardStorage.listCards()).toHaveLength(1);
    const full = generateInjectionText('full_continuation', saved!.version!.contextBody, saved!.version!.rawSnapshot);
    for (const node of transcript) expect(full).toContain(`[${node.role.toUpperCase()}]\n${node.text}`);
    expect(full.indexOf(transcript[0].text)).toBeLessThan(full.indexOf(transcript[2].text));
    expect(full).not.toContain('[CARRY CARD SUMMARY]');
    expect(generateInjectionText('summary', summary, transcript)).toContain('[CARRY CARD SUMMARY]');
  });

  it('retains raw snapshots in additional versions and JSON backups', async () => {
    const { card } = await cardStorage.createCard({ title: 'Versioned', platform: 'claude', contextBody: [] });
    const version = await cardStorage.createVersion(card.id, { platform: 'claude', contextBody: [], rawSnapshot: transcript });
    expect((await cardStorage.getCardWithCurrentVersion(card.id))?.version?.id).toBe(version.id);
    expect(JSON.parse(await cardStorage.exportJson()).data.carryCardVersions.find((v: { id: string }) => v.id === version.id).rawSnapshot).toEqual(transcript);
  });

  it('does not fabricate a full conversation from an old summary-only card', () => {
    const summary = generateStructuredSummary('chatgpt', null, transcript);
    expect(() => generateInjectionText('full_continuation', summary)).toThrow('Recapture');
    expect(() => generateInjectionText('full_continuation', summary, [])).toThrow('Recapture');
    expect(generateInjectionText('full_continuation', transcript)).toContain('Next, add retries.');
  });

  it('preserves paragraphs, code indentation and literal HTML from a captured page', async () => {
    const doc = new DOMParser().parseFromString('<div data-message-author-role="assistant"><div class="markdown"><p>First paragraph</p><p>Second paragraph</p><pre><code class="language-python">if x &lt; 3:\n    print("&lt;b&gt;literal&lt;/b&gt;")</code></pre><button>Copy</button></div></div>', 'text/html');
    const nodes = await chatgptAdapter.extractConversation(doc, 'https://chatgpt.com/c/test');
    expect(nodes[0].text).toContain('First paragraph\n');
    expect(nodes[0].text).toContain('```python\nif x < 3:\n    print("<b>literal</b>")\n```');
    expect(nodes[0].text).not.toContain('Copy');
  });

  it('adds updatedAt sorting to an existing v2 database without losing data', async () => {
    db.close();
    await db.delete();
    const old = new Dexie('ConvoCarryLocalDB');
    old.version(2).stores({ carryCards: 'id, title, syncStatus, deletedAt, createdAt', carryCardVersions: 'id, carryCardId, parentId, syncStatus', attachmentsMetadata: 'id, versionId', settings: 'key', usage: 'id, eventType, timestamp' });
    await old.table('carryCards').put({ id: 'old', title: 'Kept', updatedAt: new Date(), createdAt: new Date(), tags: [], syncStatus: 'local_only' });
    await old.table('carryCardVersions').put({ id: 'v1', carryCardId: 'old', contextBody: transcript });
    old.close();
    const upgraded = new ConvoCarryDatabase();
    expect(await upgraded.carryCards.orderBy('updatedAt').toArray()).toHaveLength(1);
    expect((await upgraded.carryCardVersions.get('v1'))?.contextBody).toEqual(transcript);
    upgraded.close();
    await db.open();
  });
});
