# 🚀 ConvoCarry AI

> Capture AI chat context. Save it as a **Carry Card**. Inject it anywhere.

**ConvoCarry AI** is a Chrome extension that lets you capture conversation context from supported AI tools (ChatGPT, Claude), save it as a reusable "Carry Card", and inject it into another AI chat — across sessions, browser profiles, or team members. No copy-pasting. No lost context.

---

## What ConvoCarry AI Does

| Feature | Description |
|---|---|
| **Carry Cards** | Portable snapshots of AI conversations — structured, searchable, reusable |
| **Full Continuation** | Inject an entire conversation into a new AI chat as context |
| **Summary Inject** | Inject an AI-generated summary instead of the full conversation |
| **Account Handoff** | Share a Carry Card via encrypted link — hand off research to a colleague or another browser profile |
| **Cloud Sync** | Sync cards across devices and browser profiles (Pro) |
| **Local-First** | Free users store everything locally in IndexedDB — no account required |

### Supported AI Tools (MVP)

- ✅ ChatGPT (chatgpt.com)
- ✅ Claude (claude.ai)
- 🔜 Gemini, Perplexity, Copilot Chat (post-MVP)

### Use Cases

- **Research continuity** — Pick up a research thread across sessions without re-explaining context
- **Personal / work separation** — Move a conversation from your personal AI account to your work account
- **Team handoff** — Share investigation context with a teammate in one click
- **AI workflow memory** — Build a library of reusable context cards for recurring tasks
- **Cross-tool migration** — Start a conversation in ChatGPT, continue it in Claude

---

## Monorepo Structure

```
convocarry-ai/
├── apps/
│   ├── extension/          # Chrome extension (WXT + React + TypeScript)
│   ├── api/                # Backend API (Fastify + Prisma + PostgreSQL)
│   ├── web-dashboard/      # Marketing site + web dashboard (Vite + React)
│   └── mcp-server/         # MCP server for AI tool integration
├── packages/
│   ├── shared-types/       # Shared TypeScript types & schemas
│   ├── adapters/           # Site-specific extraction/injection adapters
│   ├── security/           # Sanitization, validation, encryption
│   └── sdk/                # Public SDK for third-party integrations
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.mjs
└── .prettierrc
```

---

## Local Development

### Prerequisites

- **Node.js** ≥ 20.0.0
- **pnpm** ≥ 9.0.0 (`npm install -g pnpm`)
- **PostgreSQL** ≥ 15 (for API development)
- **Chrome** ≥ 120 (for extension testing)

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/convocarry-ai.git
cd convocarry-ai

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Edit .env with your Supabase, Stripe, and database credentials

# Run database migrations (if API is set up)
pnpm --filter @convocarry/api prisma:migrate
```

### Development Scripts

| Command | Description |
|---|---|
| `pnpm dev:extension` | Start the Chrome extension in dev mode (HMR) |
| `pnpm dev:api` | Start the Fastify API server |
| `pnpm dev:web` | Start the web dashboard dev server |
| `pnpm dev:mcp` | Start the MCP server |
| `pnpm build` | Build all packages and apps |
| `pnpm test` | Run tests across all packages |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm format` | Format all files with Prettier |
| `pnpm clean` | Remove all build artifacts |

---

## Chrome Extension Loading Steps

### Development (Unpacked)

1. Run `pnpm dev:extension` — this starts WXT in dev mode with HMR
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `apps/extension/.output/chrome-mv3-dev` directory
6. The ConvoCarry AI icon appears in your toolbar
7. Pin it for easy access

> **Note:** WXT automatically reloads the extension when you save changes. If the popup doesn't update, click the refresh icon on the extension card in `chrome://extensions`.

### Production (Packed)

1. Run `pnpm build` — builds all packages, then the extension
2. The production build is at `apps/extension/.output/chrome-mv3`
3. This directory can be zipped and uploaded to the Chrome Web Store

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes (API) | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes (API + Extension) | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (API only) | Supabase service role key (server-side only, never expose) |
| `DATABASE_URL` | Yes (API) | PostgreSQL connection string |
| `STRIPE_SECRET_KEY` | Yes (API) | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes (API) | Stripe webhook signing secret |
| `STRIPE_PRO_PRICE_ID` | Yes (API) | Stripe Price ID for Pro plan |
| `STRIPE_TEAM_PRICE_ID` | Yes (API) | Stripe Price ID for Team plan |
| `API_PORT` | No | API server port (default: 3001) |
| `API_HOST` | No | API server host (default: 0.0.0.0) |
| `CORS_ORIGIN` | No | Allowed CORS origin (default: http://localhost:5173) |
| `VITE_API_URL` | Yes (Extension + Web) | API base URL for client-side code |
| `VITE_SUPABASE_URL` | Yes (Extension + Web) | Supabase URL for client-side code |
| `VITE_SUPABASE_ANON_KEY` | Yes (Extension + Web) | Supabase anon key for client-side code |

> **Security:** Variables prefixed with `VITE_` are embedded in client-side bundles and are publicly visible. Never put secrets in `VITE_` variables.

---

## Privacy Model

ConvoCarry AI is designed with a **local-first, privacy-respecting architecture**:

### Data Storage

| Data | Free Users | Pro / Team Users |
|---|---|---|
| Carry Cards | IndexedDB (local only, never leaves browser) | Local + encrypted cloud sync (PostgreSQL) |
| User preferences | `chrome.storage.local` | `chrome.storage.local` + cloud backup |
| Auth tokens | No session in local mode | Extension IndexedDB (not application-encrypted) |
| Conversation content | Never sent to ConvoCarry servers | Encrypted at rest in PostgreSQL |

### What We Do NOT Do

- ❌ Read or store your AI service credentials (API keys, session tokens)
- ❌ Send captured conversations to third parties without an explicit cloud action. Optional sign-in contacts Google through the configured API; billing uses Stripe.
- ❌ Run persistent content scripts on AI sites
- ❌ Access any website without explicit user action (click)
- ❌ Auto-submit messages on your behalf (injection places text in the input — you press Enter)
- ❌ Track browsing history or activity outside of explicit capture actions
- ❌ Execute any HTML, scripts, or code from captured conversation content

### Permissions Explained

| Permission | Why |
|---|---|
| `activeTab` | Access the current tab's DOM **only** when you click the extension icon |
| `scripting` | Inject the capture/inject script into the active tab after your click |
| `storage` | Store preferences and sync metadata |
| `identity` | Google sign-in for cloud sync (optional — not needed for Free tier) |

---

## Store Compliance Notes

ConvoCarry AI is designed for **Chrome Web Store Manifest V3** compliance:

- **Single purpose:** Capture and transfer AI chat context via Carry Cards
- **Manifest V3:** Service worker background, no persistent background page
- **No remote code:** All code is bundled in the extension package. No `eval()`, no dynamic remote imports
- **Minimal permissions:** `activeTab` + `scripting` + `storage` + `identity`. No `<all_urls>`, no `host_permissions`
- **No deceptive behavior:** Extension does exactly what it describes
- **Privacy policy:** Published at [convocarry.ai/privacy](https://convocarry.ai/privacy) (required for store listing)
- **Content Security Policy:** Strict CSP — no `unsafe-eval`, no `unsafe-inline`
- **User data protection:** Local storage by default, cloud sync requires explicit opt-in
- **No web page manipulation:** Extension reads DOM (extraction) and sets input values (injection). Does not modify page appearance, inject ads, or alter rendered content

---

## Monetization Gates

| Feature | Free | Pro ($8/mo) | Team ($14/user/mo) |
|---|---|---|---|
| Local Carry Cards | 5 max | Unlimited | Unlimited |
| Capture from ChatGPT / Claude | ✅ | ✅ | ✅ |
| Full Continuation inject | ✅ | ✅ | ✅ |
| Export (JSON / Markdown) | ✅ | ✅ | ✅ |
| Summary Inject | ❌ | ✅ | ✅ |
| Cloud Sync | ❌ | ✅ | ✅ |
| Account Handoff (share by link) | ❌ | ✅ | ✅ |
| Cross-profile sync | ❌ | ✅ | ✅ |
| MCP server access | ❌ | ✅ | ✅ |
| Shared team card library | ❌ | ❌ | ✅ |
| Team handoff assignments | ❌ | ❌ | ✅ |
| Admin dashboard | ❌ | ❌ | ✅ |
| API / SDK access | ❌ | ❌ | ✅ |
| Priority support | ❌ | ✅ | ✅ |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Extension | TypeScript, React, WXT (Vite), Manifest V3 |
| API | Node.js, Fastify, Prisma, PostgreSQL |
| Auth | Supabase Auth (Google sign-in) |
| Payments | Stripe (Checkout + Customer Portal) |
| Local Storage | IndexedDB (via Dexie.js) |
| Cloud Storage | PostgreSQL (via Prisma) |
| Monorepo | pnpm workspaces |
| Testing | Vitest |
| Linting | ESLint 9 (flat config) |
| Formatting | Prettier |

---

## License

Proprietary. All rights reserved.

Extension local mode, OAuth setup, transcript limitations and regression commands are documented in [apps/extension/README.md](apps/extension/README.md).
