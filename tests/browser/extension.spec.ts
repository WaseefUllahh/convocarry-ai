import { test, expect, chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

let context: BrowserContext;
let worker: Worker;
let extensionId: string;
let scratch: string;

const source = `<button aria-label="Alice Profile">Alice</button>
  <div data-message-author-role="user"><div>Build a local Python API.</div></div>
  <div data-message-author-role="assistant"><div class="markdown"><p>Keep the code below.</p><pre><code class="language-python">if count &lt; 3:\n    print("&lt;b&gt;literal&lt;/b&gt;")</code></pre></div></div>
  <div data-message-author-role="user"><div>Next, add retries.</div></div>`;

test.beforeEach(async () => {
  scratch = await mkdtemp(path.join(tmpdir(), 'convocarry-browser-'));
  const extension = path.join(scratch, 'extension');
  await cp('apps/extension/.output/chrome-mv3', extension, { recursive: true });
  const manifestPath = path.join(extension, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  // A tab fixture cannot click the toolbar to grant activeTab. Grant ONLY fixture hosts
  // in this temporary copy; the production manifest remains activeTab-only.
  manifest.host_permissions = [...(manifest.host_permissions || []), 'https://chatgpt.com/*', 'https://claude.ai/*'];
  await writeFile(manifestPath, JSON.stringify(manifest));
  context = await chromium.launchPersistentContext(path.join(scratch, 'profile'), {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  extensionId = new URL(worker.url()).host;
});

test.afterEach(async () => {
  await context?.close();
  await rm(scratch, { recursive: true, force: true });
});

async function chat(url: string, html: string): Promise<Page> {
  await context.route(url, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body>${html}</body></html>` }));
  const page = await context.newPage();
  await page.goto(url);
  await page.bringToFront();
  return page;
}

async function popup(): Promise<Page> {
  const newPage = context.waitForEvent('page');
  await worker.evaluate(async url => {
    await (globalThis as any).chrome.tabs.create({ url, active: false });
  }, `chrome-extension://${extensionId}/popup.html`);
  const page = await newPage;
  await page.waitForLoadState();
  return page;
}

async function capture(): Promise<void> {
  const page = await popup();
  await page.getByRole('button', { name: 'Continue locally (Free)' }).click();
  await expect(page.getByText('Local Storage Only')).toBeVisible();
  await expect(page.getByText('Pro Sync Active')).toHaveCount(0);
  await page.getByRole('button', { name: 'Capture Chat', exact: true }).click();
  await expect(page.getByText('Chat Captured Successfully!')).toBeVisible();
  await page.close();
}

test('local capture survives reopening and Full Continuation inserts literal code into Claude', async () => {
  const errors: string[] = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  await chat('https://chatgpt.com/c/source', source);
  await capture();
  const destination = await chat('https://claude.ai/new', '<button aria-label="Alice Profile">Alice</button><div contenteditable="true"></div>');
  const page = await popup();
  await expect(page.getByRole('button', { name: 'Continue locally (Free)' })).toHaveCount(0);
  await expect(page.locator('select')).toContainText('Build a local Python API.');
  await page.getByRole('radio', { name: 'Full', exact: true }).check();
  await page.getByRole('button', { name: 'Inject Carry Card' }).click();
  await expect(destination.locator('[contenteditable]')).toContainText('Next, add retries.');
  const inserted = await destination.locator('[contenteditable]').innerText();
  expect(inserted).toContain('```python\nif count < 3:\n    print("<b>literal</b>")\n```');
  expect(inserted).toContain('[USER]\nBuild a local Python API.');
  expect(inserted).not.toContain('[CARRY CARD SUMMARY]');
  expect(await destination.locator('[contenteditable] b').count()).toBe(0);
  await expect.poll(async () => worker.evaluate(async () => (await (globalThis as any).chrome.storage.local.get('cc_milestone_first_full_continuation_injected')).cc_milestone_first_full_continuation_injected)).toBe(true);
  expect(errors).toEqual([]);
});

test('missing composer reports failure and does not record a successful injection', async () => {
  await chat('https://chatgpt.com/c/source', source);
  await capture();
  await chat('https://chatgpt.com/c/destination', '<p>No composer yet</p>');
  const page = await popup();
  await page.getByRole('button', { name: 'Inject Carry Card' }).click();
  await expect(page.getByText('Composer not found.', { exact: false })).toBeVisible();
  const data = await worker.evaluate(async () => (globalThis as any).chrome.storage.local.get('cc_milestone_first_summary_injected'));
  expect(data.cc_milestone_first_summary_injected).toBeUndefined();
});

test('account mismatch confirmation preserves the selected destination and mode', async () => {
  await chat('https://chatgpt.com/c/source', source);
  await capture();
  const destination = await chat('https://chatgpt.com/c/destination', '<button aria-label="Bob Profile">Bob</button><textarea id="prompt-textarea"></textarea>');
  const page = await popup();
  await page.getByRole('radio', { name: 'Full', exact: true }).check();
  await page.getByRole('button', { name: 'Inject Carry Card' }).click();
  await expect(page.getByText('Account Mismatch', { exact: true })).toBeVisible();
  await expect(destination.locator('textarea')).toHaveValue('');
  await page.getByRole('button', { name: 'Yes, Inject' }).click();
  await expect(destination.locator('textarea')).toHaveValue(/Next, add retries\./);
  await expect.poll(async () => worker.evaluate(async () => (await (globalThis as any).chrome.storage.local.get('cc_milestone_first_full_continuation_injected')).cc_milestone_first_full_continuation_injected)).toBe(true);
});
