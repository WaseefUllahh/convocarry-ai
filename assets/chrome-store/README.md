# ConvoCarry AI: Chrome Store Screenshots

This directory contains the final 1280x800 screenshots required for the Chrome Web Store submission.

## Files to Upload (Primary 5)
These 5 screenshots form the core narrative of the extension and MUST be uploaded to the Chrome Web Store in this exact order:

1. `01-dashboard-carry-cards.png` - "Save AI conversations as Carry Cards"
2. `02-capture-only-on-click.png` - "Capture only when you click"
3. `03-inject-summary-continuation.png` - "Inject Summary or Full Continuation"
4. `04-account-handoff.png` - "Send context to another account"
5. `05-cloud-sync-mcp.png` - "Sync across devices with Pro"

## Backup / Social Asset
This 6th screenshot is reserved for Landing Page hero sections, Product Hunt, or Social Media. Do not include it in the primary 5 Chrome Store slots to avoid clutter.

* `06-privacy-backup.png` - "Total Privacy Control"

## Image Specifications
- **Dimensions**: Exactly `1280x800` pixels.
- **Format**: PNG
- **Safety Guidelines Enforced**:
  - No real user emails, API keys, or personal chat data.
  - Abstract UI representations ("AI Chat A") used instead of literal competitor UI clones to avoid implied endorsements.
  - Text is verified to be completely legible when downscaled to Chrome Store thumbnail sizes.
  - Layout is strictly bounded with no scrollbars or overlapping text.

## Usage Notes for Exporting
The programmatic PNG export buttons are located inside the `@convocarry/web-dashboard` client. To export these images locally:
1. Run the dashboard server: `pnpm --filter @convocarry/web-dashboard dev`
2. Navigate to `http://localhost:5173/screenshots/dashboard`
3. Click the **Export PNG** button. The file will download natively without the button appearing in the shot.
4. Rename the downloaded files according to the structure above and move them into this directory.
