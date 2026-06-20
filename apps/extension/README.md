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
5. Click **Capture Chat** or **Inject Carry Card**. Notice the browser alerts firing via `chrome.scripting.executeScript` through the `activeTab` permission.
6. Check `chrome://extensions` to verify that no `content_scripts` are persisting in the background, enforcing our privacy-first rule.
