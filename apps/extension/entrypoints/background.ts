// Background Service Worker
// MV3 requires this to be a module type if using ES modules (configured in wxt.config.ts)

import { defineBackground } from 'wxt/sandbox';

export default defineBackground(() => {
  console.log('ConvoCarry AI Background Service Worker initialized.');

  // Handle cross-extension or background lifecycle events here.
  // In the MVP, most logic is driven directly from the Popup via activeTab + scripting.
  // This ensures no persistent content scripts are running on the user's browser.
});
