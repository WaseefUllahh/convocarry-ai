import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
    const apiUrl = new URL(import.meta.env.VITE_API_URL || 'https://api.convocarry.ai');
    if (clientId && !clientId.endsWith('.apps.googleusercontent.com')) {
      throw new Error('VITE_GOOGLE_CLIENT_ID must be a Google OAuth client ID.');
    }
    return {
    name: 'ConvoCarry AI',
    description: 'Carry AI chat context across tools and accounts.',
    version: '0.1.0',
    manifest_version: 3,
    permissions: ['activeTab', 'scripting', 'storage', ...(clientId ? ['identity'] : [])],
    ...(clientId ? {
      oauth2: { client_id: clientId, scopes: ['openid', 'email'] },
      host_permissions: [`${apiUrl.origin}/*`],
    } : {}),
    ...(import.meta.env.VITE_EXTENSION_PUBLIC_KEY ? { key: import.meta.env.VITE_EXTENSION_PUBLIC_KEY } : {}),
    action: {
      default_popup: 'popup.html',
      default_icon: {
        "16": "icons/icon16.png",
        "32": "icons/icon32.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png"
      }
    },
    icons: {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    },
    background: {
      type: "module",
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
    };
  },
  runner: {
    startUrls: ['https://chatgpt.com', 'https://claude.ai'],
  },
});
