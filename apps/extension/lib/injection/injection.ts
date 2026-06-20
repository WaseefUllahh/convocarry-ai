import { LocalCarryCardVersion } from '../storage/cards';

export const injectionAdapter = {
  // In reality, this would read from the DOM or extension context
  // e.g., ChatGPT DOM for user email, or Claude DOM for team workspace
  getActiveAccountLabel(): string {
    // Mock implementation for MVP
    return 'default_active_account@example.com';
  },

  async verifyInjectionSafety(version: LocalCarryCardVersion): Promise<boolean> {
    const activeAccount = this.getActiveAccountLabel();
    const sourceAccount = version.sourceAccountLabel;

    if (sourceAccount && activeAccount && sourceAccount !== activeAccount) {
      // For a real extension, this might be a custom UI modal injected into the DOM
      // or a chrome.windows popup
      return window.confirm(
        `Injection Safety Warning:\n\nThis Carry Card was captured from [${sourceAccount}]. You are currently signed in as [${activeAccount}].\n\nInject anyway?`
      );
    }
    return true;
  },

  injectContextBody(version: LocalCarryCardVersion) {
    console.log('Injecting Summary mode:', version.contextBody);
    // Logic to drop into textarea/contenteditable and dispatch event
  },

  injectRawSnapshot(version: LocalCarryCardVersion) {
    console.log('Injecting Full Continuation mode:', version.rawSnapshot);
    // Logic to format raw transcript and drop into textarea
  }
};
