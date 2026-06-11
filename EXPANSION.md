# Elevateo Posts — Expansion Plan

This document captures the current state of the MVP, the compromises made to
ship it, and the planned direction for turning it into a real product.

---

## Part 1: Current State (MVP)

A working, single-user LinkedIn post creation tool built on **Next.js 16 /
React 19 / Tailwind 4**. The full creative loop works end to end.

### What exists

**Flow:**
1. **Onboarding** (6 steps) — builds a voice profile (name, title, industry,
   target audience, unique background, contrarian view, personal story, tone).
2. **Find** (`/find`) — searches real LinkedIn posts via Apify, filters by
   engagement/time/author, generates 6 AI post ideas (alternating
   personal/topical).
3. **Write** (`/write`) — AI drafts a post; split-view editor (55% editor /
   45% live LinkedIn preview); inline AI editing (select text →
   rewrite/shorten/expand/bolder/softer/custom), streamed with accept/reject
   diff panel.
4. **Drafts & history** — in-progress drafts and finished posts.
5. **Profile** (`/profile`) — editable anytime.
6. **Feedback** — gold banner → modal → Telegram ping.

**AI:** OpenAI `gpt-5.4-mini`. Three routes:
- `/api/ai/generate-suggestions` (non-streaming) — profile + posts → 6 ideas
- `/api/ai/generate-draft` (non-streaming) — profile + suggestion + posts → draft
- `/api/ai/inline-edit` (streaming SSE) — selected text + action → replacement

**External APIs:**
- `/api/search-posts` → Apify actor `harvestapi~linkedin-post-search`
- `/api/feedback` → Telegram Bot API

**Branding:** Full Elevateo gold-on-charcoal theme, logo, naming.

### Data persistence (all client-side localStorage)

| Key | Shape |
|-----|-------|
| `linkedin-poster-profile` | UserProfile |
| `linkedin-poster-search` | last SavedSearch (queries + posts) |
| `linkedin-poster-drafts` | SavedDraft[] (in-progress) |
| `linkedin-poster-history` | SavedDraft[] (finished) |
| `linkedin-poster-draft-context` | DraftContext (inspiration posts) |
| `linkedin-poster-current-draft` | string (unsaved draft text) |

**Zero server-side persistence. No database. No accounts.**

### Env vars

```
OPENAI_API_KEY
APIFY_API_TOKEN
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

---

## Part 2: MVP Compromises / Limitations

Deliberate shortcuts. Fine for internal team testing; real gaps for a product.

1. **No backend, no database, no accounts.** Everything is in browser
   `localStorage`. One browser = one user. Clearing cache loses everything. No
   login, no identity, no cross-device. Each team member has an isolated,
   invisible-to-others copy.

2. **No actual LinkedIn publishing.** The flow ends at "copy to clipboard."
   There's a faithful preview but no OAuth connection and no publishing.

3. **Shared secrets, not per-user.** One `OPENAI_API_KEY` and one
   `APIFY_API_TOKEN` for the whole app. All users' calls bill to the same keys,
   with no per-user limits, quotas, or usage tracking. One user can burn the
   budget.

4. **No real avatars/identity in the preview.** Shows a letter, not a photo or
   real LinkedIn name — it's profile text the user typed.

5. **Feedback is fire-and-forget.** One Telegram chat, no in-app record, no
   per-user attribution beyond the typed name.

6. **No safety rails on AI/external calls.** No rate limiting, no
   retry/timeout on Apify, no error tracking (Sentry), inline-only error UI.
   API keys have been exposed in dev chat — **rotate them** before anything but
   private testing.

7. **`expertise` profile field exists but is never collected** in onboarding
   (only used if present). Loose end.

8. **Two parallel draft-storage systems** (`storage.ts` drafts +
   `draft-store.ts` context). Inspiration posts aren't tied per-draft; they're
   global to the last-selected suggestion. Consolidate when there's a backend.

### Bottom line

All value is in the **UI/UX and the AI prompts**. There is essentially **zero
backend logic** — every route is a thin pass-through to OpenAI/Apify/Telegram.
The hard, opinionated product work is done and proven. What's left is the
standard SaaS foundation underneath it.

### Foundational work to go "real" (priority order)

1. **Auth + database** (unlocks everything): pick a stack (e.g. Supabase or
   Clerk + Postgres/Prisma), add login, move all six localStorage keys to
   per-user DB tables.
2. **Per-user API usage**: track/limit AI + Apify calls per user, or BYOK.
3. **LinkedIn publishing**: OAuth `w_member_social` + a publish route.
4. **Hardening**: rate limits, timeouts/retries, error tracking, rotate keys.

---

## Part 3: Planned Features (Expansion Notes)

The intended direction for the product. Numbered as provided.

### 1. BYOK (Bring Your Own Key) — multi-provider AI

- Users supply their own API key and choose the **provider**: Claude (Anthropic),
  OpenAI, or Gemini (Google).
- Users can also select the **specific model** within a provider.
- Implication: the AI layer (`src/lib/openai.ts` + the three `/api/ai/*` routes)
  must be abstracted behind a provider-agnostic interface. Each provider has a
  different request/response/streaming shape, so we need an adapter per provider
  that normalizes to a common `chatCompletion` / `chatCompletionStream` contract.
- Keys are per-user secrets — needs secure storage (encrypted at rest if there's
  a backend; or kept local if the app is local-only, see #2).

### 2. Downloadable local desktop application — DONE (Electron, unsigned)

- Thin Electron shell in `electron/` (its own mini-project, so the Railway web
  deploy never installs Electron). It loads the live Railway URL in a window
  AND spawns the bundled Claude proxy on `localhost:42069`. The window is the
  one place a hosted page can reach localhost (a normal browser can't — mixed
  content / CORS), which is the whole reason the desktop app exists.
- The proxy (`proxy/`, brought over from landing-page-builder) is an
  OpenAI-compatible Claude proxy with its own OAuth — users sign into their
  Claude account in Settings (no API key, uses their Claude subscription).
  Bundled and run via the Electron binary as Node, so users need no Node.js.
- `local-claude` provider wiring: the server can't reach the user's localhost,
  so the `/api/ai/*` routes DEFER for local-claude — they build the prompt and
  return `{ localProxy, messages, maxTokens }`; the desktop client runs it
  against the proxy and (for JSON routes) resubmits the text so the route's own
  parsing runs. Zero logic duplication. Covers draft, suggestions, hashtags,
  image-prompt, and streaming inline-edit.
- Desktop detection: `window.elevateoDesktop` (preload) + `Elevateo-Desktop`
  user-agent tag (`src/lib/desktop.ts`). In a browser, Settings shows
  "Download the desktop app"; in the shell, the sign-in flow.
- Builds are **unsigned** (one-time OS prompt). Windows `.exe` builds anywhere;
  Mac `.dmg` must build on a Mac. Distributed via GitHub Releases; the Settings
  download links point at the latest release assets (override via
  `NEXT_PUBLIC_DESKTOP_DOWNLOAD_{WIN,MAC}`). See `DESKTOP.md`.

### 3. Image creator (BYOK) — DONE (Gemini)

- Generate images for posts using the user's **Gemini** key (reuses BYOK; no
  separate image key). Implemented with `gemini-3.1-flash-image` ("Nano Banana")
  via `:generateContent` on the **v1beta** path (v1 rejects responseModalities/
  imageConfig — verified live). `src/lib/ai/image.ts` + `/api/ai/generate-image`
  (resolves the Gemini key specifically via `resolveGeminiKey`, independent of
  the active text provider).
- Editor: inline `ImageComposer` panel — on open it auto-suggests a prompt from
  the post (`/api/ai/suggest-image-prompt`, uses the active text provider),
  editable; aspect ratio; generate/regenerate/remove; alt text. The image is
  held as a **data URL** (no object storage) and **persisted on the draft**
  (`image_data`/`image_mime`/`image_alt` columns) and mirrored into the LinkedIn
  preview card.
- LinkedIn attach (auto): the publish flow does the 3-call Images API flow —
  `initializeUpload` → PUT raw bytes (Authorization required for images) →
  create post with `content.media`. Sufficient with `w_member_social`.
- **Caveats noted for future work:**
  - Every Gemini image carries an invisible **SynthID watermark** (unavoidable).
  - LinkedIn processes the uploaded image **asynchronously** and the readiness
    GET (`/rest/images/{urn}`) is **blocked for `w_member_social`-only tokens**,
    so we can't poll. The publish route uses a short delay + one retry to dodge
    the "image not AVAILABLE yet" race; may need tuning under load.
  - Images are stored base64 on the post row (can be ~1-2MB). Fine for now; if
    this grows, move to object storage.

### 4. Hashtag generation as a separate agent

- After the main draft is generated, a **second agent runs** to produce relevant
  hashtags for the post.
- Implication: a new `/api/ai/generate-hashtags` route that takes the finished
  draft (+ profile/topic context) and returns a short, relevant hashtag set.
  Runs as a follow-up step in the write flow, not bundled into the draft prompt,
  so hashtags can be regenerated independently.

### 5. Per-user post history

- Each user has **their own history** of posts they can reopen.
- This is already prototyped client-side (`linkedin-poster-history`), but for
  multi-user it must move to per-user backend storage (depends on auth + DB from
  Part 2). Reopening a finished post should restore it into the editor.

### 6. LinkedIn OAuth + direct posting (with Telegram fallback)

- **Preferred:** direct **OAuth into the user's LinkedIn account**, then post
  directly via that OAuth connection (`w_member_social` scope on LinkedIn's
  official API).
- **Fallback (if OAuth posting isn't feasible):** the **Telegram bot DMs the user
  their finished post** directly, so they can copy/paste it into LinkedIn
  manually. (Note: the current feedback bot sends to one fixed chat; this would
  need per-user Telegram linkage so each user gets their own DM.)

### 7. Scheduled posting (depends on #6 OAuth working)

- **If** OAuth posting is available, allow users to **schedule posts** to be
  published at a chosen time.
- Implication: requires a backend with a scheduler/queue (the post must be
  published server-side at the scheduled time, independent of whether the user's
  browser/app is open) plus stored LinkedIn OAuth tokens per user. This is the
  one feature that fundamentally cannot be local-only — it needs an always-on
  server to fire scheduled posts, OR the local app must be running at the
  scheduled time.

### 8. Smarter post ideas — learn from the team's own LinkedIn results

- Personalize idea generation using **how the user's own published posts
  actually performed** (likes/comments over time), rather than only strangers'
  posts. E.g. "your hiring posts outperform your product posts 3:1 — here are
  more hiring angles."
- Mechanism: after a user connects LinkedIn (#6), periodically read back their
  own posts + engagement, store a per-user performance history, and feed the
  patterns into the `generate-suggestions` prompt (weight ideas toward what
  has worked for *this* author and audience).
- **Gating risk (important):** reading a member's own posts/analytics needs the
  **`r_member_social`** scope, which is **approval-gated** by LinkedIn (NOT
  self-serve like `w_member_social` posting). LinkedIn approval could be slow or
  denied — this is the main blocker, and the feature can't ship without it.
- Storage: a per-user table of post performance snapshots (post URN, engagement
  counts, captured-at). Depends on auth + DB (already built).
- Lower-effort precursor (no approval needed): tighten the *current*
  `generate-suggestions` prompt to explicitly analyze the engagement numbers it
  already receives — identify what made the top inspiration posts work (hook
  style, format, length, angle) and apply those patterns. Uses data we already
  fetch; a contained prompt change. Good interim step toward #8.

### 9. Trend feed / topic radar

- A standing, always-on **"what's hot this week in your space"** view: on a
  schedule, pull top-performing posts for the user's industry/topics, store them
  over time, and surface them as ready-made inspiration — independent of the
  user running a manual Find search.
- Mechanism: a scheduled job (same scheduler infra as #7) runs saved searches
  via Apify, dedupes/stores results, and a new UI surfaces the trending set,
  which can seed idea generation directly.
- **Cost note:** more Apify usage (scheduled, recurring) — has an ongoing API
  cost that scales with how many topics/users we track. Needs storage of trend
  data over time and new UI. The most infrastructure-heavy of the idea features.
- Depends on: backend scheduler (shared with #7), DB storage, Apify budget.

---

## Part 4: Cross-Cutting Dependencies

Quick map of what each expansion feature depends on, so build order is clear.

- **#1 BYOK** — needs a provider-abstraction layer. Independent of backend
  (keys can be local). Foundational for #3.
- **#2 Local app** — packaging effort; enables local Claude Code proxy. Largely
  independent, but shapes where keys/credentials live.
- **#3 Image creator** — builds on #1 (BYOK provider abstraction).
- **#4 Hashtags** — small, independent; just a new agent/route.
- **#5 Per-user history** — needs **auth + database** (Part 2, item 1).
- **#6 LinkedIn OAuth/posting** — needs LinkedIn app registration + OAuth; needs
  backend to store tokens (unless local-only). Telegram fallback needs per-user
  bot linkage.
- **#7 Scheduling** — needs **#6 working** + an **always-on backend scheduler**.
  The only feature that breaks the "local-only" model.
- **#8 Smarter ideas (own results)** — needs **#6 working** + LinkedIn's
  **approval-gated `r_member_social`** scope + per-user performance storage
  (auth + DB, already built). The low-effort prompt-only precursor needs none of
  this.
- **#9 Trend feed** — needs the **#7 scheduler** + DB storage + ongoing Apify
  budget. Server-side only (recurring jobs), so it also breaks "local-only."

**Tension to resolve:** #2 (local desktop app) and #7 (server-side scheduling)
pull in opposite directions — one wants everything on the user's machine, the
other needs an always-on server. Resolved below.

---

## Part 5: Resolved Architecture — Thin-Client Model

The conflict between "local app" and "server-side scheduling" dissolves if the
**server is the single source of truth** and both clients are thin frontends
pointing at the same backend. This is the **Discord model**.

### The pieces

- **Railway server = the product.** Hosts the Next.js backend, the database, the
  scheduler/queue, user accounts, LinkedIn OAuth tokens, and post history. Always
  on. Owns all state.
- **Web app** — the frontend, served from the Railway server. Runs in a browser.
- **Desktop app (Electron)** — the *same* frontend, packaged as a downloadable
  app, talking to the *same* Railway backend over HTTPS. Just like the Discord
  desktop client connects to Discord's servers.
- Users can **download the desktop app directly from the web version**.

### Why both clients point at the same backend

- **Scheduling always works** — scheduled posts fire **server-side** on Railway,
  independent of whether any client (web or desktop) is open. No "local app must
  be running" requirement.
- **History, OAuth, posting, generation** all go through the Railway backend for
  **both** web and desktop users. One codepath, one database, one source of truth.
- A user can start a draft on the web app and finish it in the desktop app — same
  account, same data.

### The ONE reason the desktop app exists: local Claude Code proxy

The only thing a browser tab on a hosted web app **cannot** do is reach the
user's `localhost`. The local Claude Code proxy (#2) runs on
`http://localhost:<port>` on the user's machine.

- A **browser** (web app) cannot call the user's localhost → can't use the local
  Claude proxy.
- An **Electron app** runs as a local process on the user's machine → it **can**
  call `http://localhost:<port>`.

So the split is:

- **Default path (web + desktop):** all AI/generation calls go through the
  Railway backend using the user's BYOK key (#1).
- **The one exception:** if a user selects **"Claude (local Claude Code)"** as
  their provider, the **desktop app** makes that specific AI call directly to
  `http://localhost:<port>` locally, bypassing the server for that call only.
- In **Settings**, the "local Claude Code" provider option is marked as
  **requiring the desktop app**. Web users can't select it (no localhost access);
  the UI explains they need to download the desktop version to use it.

### Build order this implies

1. **Build the web app properly first** (auth + DB + backend + all features on
   Railway). This is the whole product. The web app is fully usable on its own.
2. **Then wrap it as an Electron app** that connects to the same backend — a
   separate, smaller build whose only added capability is reaching `localhost`
   for the local Claude Code proxy provider.

This means we are **not** building two products. We build one server-backed
product, then add a thin desktop shell. Everything except the local-proxy call
is identical between the two clients.

---

## Part 6: Deploy Steps & Operational Notes

Running notes for deploying to Railway. Append to this as new infra is added.

### Railway environment variables (app service)

```
# AI + external APIs
OPENAI_API_KEY=<openai key>
APIFY_API_TOKEN=<apify token>
TELEGRAM_BOT_TOKEN=<bot token>
TELEGRAM_CHAT_ID=<chat id>

# Database (Railway Postgres) — use the INTERNAL url in production
DATABASE_URL=postgresql://postgres:<pw>@postgres.railway.internal:5432/railway

# Auth.js (NextAuth v5)
AUTH_SECRET=<32-byte base64 secret>   # generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
AUTH_TRUST_HOST=true                  # required behind Railway's proxy

# BYOK — master key for encrypting users' provider API keys at rest
ENCRYPTION_KEY=<32-byte base64 secret>  # same generator as AUTH_SECRET, but a DISTINCT value

# LinkedIn OAuth (Sign in with OpenID Connect + Share on LinkedIn products)
LINKEDIN_CLIENT_ID=<from LinkedIn app Auth tab>
LINKEDIN_CLIENT_SECRET=<from LinkedIn app Auth tab>
LINKEDIN_REDIRECT_URI=https://<railway-domain>/api/linkedin/callback

# Scheduled posts: shared secret guarding the cron endpoint. Set on BOTH the
# web service and the cron service (must match).
CRON_SECRET=<random secret>
```

The LinkedIn redirect URI must **exactly match** one registered in the app's
Auth tab (register both the localhost dev URI and the Railway prod URI). The
app needs the **Sign in with LinkedIn using OpenID Connect** and **Share on
LinkedIn** products (both self-serve, no approval). Stored LinkedIn access
tokens are encrypted with the same `ENCRYPTION_KEY`. LinkedIn access tokens
last ~60 days and refresh tokens are partner-gated (we don't expect them), so
users reconnect periodically — there is no token-refresh cron.

Local dev uses the **public** Postgres URL (`...proxy.rlwy.net:PORT`) in
`.env.local`; production uses the **internal** URL (`postgres.railway.internal`)
which is faster and private.

`ENCRYPTION_KEY` must be set in production **before** any user saves a provider
key, and must **never change** afterwards — rotating it makes every stored key
undecryptable (the resolver returns a "re-enter it in Settings" error and users
must paste their keys again). Keep it distinct from `AUTH_SECRET`.

### Database migrations on deploy (IMPORTANT)

Prisma has two separate steps and BOTH must happen:

1. **`prisma generate`** — builds the TypeScript client. Runs automatically via
   the `postinstall` script on `npm install`. This does NOT touch the database.
2. **`prisma migrate deploy`** — applies pending migration SQL to the database,
   creating/altering tables. This MUST run on deploy or the new tables won't
   exist in production and every DB call 500s.

Add `prisma migrate deploy` to the Railway deploy/release step (or run it once
manually against the internal DB after a schema change). `migrate deploy` is the
production-safe command — it only applies committed migrations, never prompts,
never resets.

All migration SQL files under `prisma/migrations/` are committed to git, so
production has everything it needs to run `migrate deploy`.

### Gotcha: stale Prisma client (bit us twice)

After any schema change (new model, table rename via `@@map`), the generated
client must be regenerated or it points at the old shape and throws (e.g.
`P2021: table does not exist`). `prisma migrate dev` regenerates, but a running
dev server caches the old client in memory.

**Habit:** after any migration, run `npx prisma generate` and **restart the dev
server**. If a rename ever misbehaves, a clean regen fixes it:
`rm -rf src/generated/prisma && npx prisma generate`.

### Scheduled posts: the cron service (second Railway service)

LinkedIn's API has **no native scheduling** (verified: `lifecycleState: PUBLISHED`
= publish now, no future-timestamp field). So we self-schedule: posts are stored
with `status: "scheduled"` + a UTC `scheduledFor`, and a cron fires due ones.

Railway cron **cannot run on the always-on web service** (cron requires the
service to start, do its job, and exit — a web server never exits, so every
tick would be skipped). And Railway cron's **minimum interval is 5 minutes**.
So the setup is a **separate Railway service in the same project/repo**:

1. **Web service** (existing) — exposes `POST /api/cron/publish-scheduled`,
   guarded by `CRON_SECRET` (header `x-cron-secret`). Queries due posts,
   publishes each (reusing the normal publish path), marks them
   `finished` (with `linkedin_url`) or `failed` (with `failed_reason`).
2. **Cron service** (new) — same repo, but:
   - **Start command:** `node scripts/trigger-scheduled.mjs`
     (it POSTs to the web endpoint with the secret, logs, and exits).
   - **Cron schedule:** `*/5 * * * *` (every 5 min; 5 min is Railway's floor).
   - **Env vars:** `APP_URL=https://<railway-domain>` and the same
     `CRON_SECRET` as the web service. (It needs nothing else — no DB access;
     all work happens behind the endpoint.)
   - Keep it at **1 replica** (not that it matters here — it just triggers — but
     good hygiene).

The trigger script is dependency-free (`node scripts/trigger-scheduled.mjs`,
global fetch), so the cron service builds/starts fast.

**Token-expiry caveat:** LinkedIn tokens last ~60 days and can't be refreshed.
The schedule UI blocks scheduling a post for after the user's token expires
(prompting a reconnect). If a token still expires before the post fires, the
cron marks it `failed` with a reconnect reason — content is kept so the user can
reconnect and re-post.

### Things still to wire for a clean production deploy

- [x] Add `prisma migrate deploy` to the deploy. Done via the `start` script
      (`prisma migrate deploy && next start`) so migrations apply on each boot,
      before the server accepts traffic.
- [ ] Add the **cron service** (see above): second Railway service, start command
      `node scripts/trigger-scheduled.mjs`, schedule `*/5 * * * *`, env `APP_URL`
      + `CRON_SECRET`.
- [ ] Set `CRON_SECRET` on the **web** service too (the endpoint checks it).
- [ ] Rotate any API keys that were pasted in dev chat (OpenAI, Apify) before
      going beyond private testing.
- [ ] Confirm `AUTH_TRUST_HOST=true` and a production `AUTH_SECRET` are set.
- [ ] Decide whether to clear orphaned localStorage keys from the MVP
      (`linkedin-poster-profile`, `-drafts`, `-history`, `-draft-context`) — they
      sit unused in users' browsers after the DB migration; harmless but stale.
