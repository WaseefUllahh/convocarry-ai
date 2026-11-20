# ConvoCarry AI Chrome Extension

This is the Chrome extension built with [WXT](https://wxt.dev/) and React.

## How to Build

Install dependencies and run the development server:

```bash
pnpm install
pnpm dev:extension
```

To build for production:

```bash
pnpm build
```

## How to Load Unpacked Extension (Development)

1. Open Google Chrome.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked**.
5. Select the `apps/extension/.output/chrome-mv3-dev` folder (or `chrome-mv3` for production build).

## How to Test

1. Pin the ConvoCarry AI icon to your toolbar.
2. Click the icon on any unsupported page (like `google.com`) to see the fallback UI.
3. Navigate to [ChatGPT](https://chatgpt.com) or [Claude](https://claude.ai).
4. Click the extension icon. You should see the platform detected (e.g. "Chatgpt Detected").
5. Choose **Continue locally**, capture a chat, reopen the popup on a destination chat, select **Summary** or **Full**, and click **Inject Carry Card**. Review the inserted text before sending it.
6. Check `chrome://extensions` to verify that no `content_scripts` are persisting in the background, enforcing our privacy-first rule.

## Local mode and transcripts

Local mode needs no Google account, OAuth configuration, or running API. The choice survives closing the popup. Cards keep a summary and the original ordered messages in IndexedDB. Full Continuation and the dashboard's copy action use those original messages, including code blocks and indentation.

Capture includes only messages currently loaded in the page DOM. Load older messages before capturing a long conversation. It does not fetch hidden history or download attachments. Old summary-only cards must be recaptured for Full Continuation; their summaries remain usable. The database upgrade adds sorting support without deleting existing data.

Insertion leaves existing composer drafts untouched. A missing or changed destination reports an error rather than a successful injection. The extension never presses Send.

## Optional Google sign-in

1. Register a Google OAuth client for the Chrome extension's ID. For unpacked builds, use a stable extension ID; the optional `VITE_EXTENSION_PUBLIC_KEY` is the public manifest key, never a private signing key.
2. Copy `.env.example` in this directory to `.env.local`. Set `VITE_GOOGLE_CLIENT_ID` to the public Google client ID and `VITE_API_URL` to your API origin (or its `/api/v1` base). Remote APIs must use HTTPS; localhost HTTP is supported for development.
3. On the API server, set `GOOGLE_CLIENT_ID` to the same client ID and `EXTENSION_ID` to the extension ID, alongside the existing database, provider, JWT and cron configuration. Never place server secrets in `VITE_` variables.
4. Rebuild the extension and reload it in Chrome. The configured build includes the `identity` permission, the `openid`/`email` OAuth scopes and a host permission for that API origin. An unconfigured build has no identity permission and displays local mode.
5. Click **Sign in with Google** in the popup. The API checks the token's audience, expiry and verified identity before issuing a ConvoCarry session. The popup displays the actual plan returned by the server; sign-in alone does not activate a paid subscription or automatically upload cards.

Opening the popup or requesting sync never launches interactive OAuth. Expired sessions require an explicit sign-in. Sign-out clears cached ConvoCarry and Google credentials while keeping local cards. Session data is stored in extension IndexedDB and is not application-encrypted.

This configures the extension sign-in flow. The separate web dashboard's production login flow still requires further work.

## Automated verification

From the repository root:

```bash
pnpm --filter @convocarry/adapters --filter @convocarry/extension test
pnpm --filter @convocarry/api exec vitest run __tests__/oauth-exchange.test.ts __tests__/card-access.test.ts __tests__/security-routes.test.ts
pnpm --filter @convocarry/extension build
pnpm exec playwright install chromium
pnpm test:browser
```

Browser tests load the built extension in Chromium, use real IndexedDB and Chrome scripting APIs, and serve synthetic ChatGPT/Claude DOM fixtures. A temporary manifest copy grants access only to the fixture hosts because automated tests cannot perform the toolbar gesture that grants `activeTab`. The production manifest is not modified. These tests do not prove compatibility with every live provider UI, real Google consent, or production cloud services. Before release, repeat capture and insertion in signed-in ChatGPT and Claude with the production manifest and configured Google client.

References: [Chrome identity API](https://developer.chrome.com/docs/extensions/reference/api/identity), [WXT manifest environment variables](https://wxt.dev/guide/essentials/config/environment-variables.html).
