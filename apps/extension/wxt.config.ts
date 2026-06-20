import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'ConvoCarry AI',
    description: 'Carry AI chat context across tools and accounts.',
    version: '0.1.0',
    manifest_version: 3,
    permissions: ['activeTab', 'scripting', 'storage', 'identity', 'downloads'],
    action: {
      default_popup: 'popup.html',
    },
    // Placeholder for OAuth2
    oauth2: {
      client_id: 'PLACEHOLDER_CLIENT_ID.apps.googleusercontent.com',
      scopes: ['openid', 'email', 'profile'],
    },
    icons: {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    },
    background: {
      type: "module",
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self';",
    },
  },
  runner: {
    startUrls: ['https://chatgpt.com', 'https://claude.ai'],
  },
});
