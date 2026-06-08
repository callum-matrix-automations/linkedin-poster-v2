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

### 2. Downloadable local desktop application

- Package the app so a user can **download, hit execute, and run it on their
  local PC** (e.g. an Electron/Tauri wrapper around the Next.js app, or a packaged
  Node server).
- Running locally enables **proxy use with a local Claude Code repo** the user
  has set up that exposes Claude Code as a local API. (This is the same
  local-proxy approach that worked in dev but failed on Railway — running on the
  user's own machine sidesteps the cloud-auth problem entirely, since the user is
  authenticated locally.)
- Implication: BYOK (#1) + local execution means keys/credentials can live on the
  user's machine, not a shared server. The "Claude" provider option could point
  at `http://localhost:<port>` for the local Claude Code proxy.

### 3. Image creator (BYOK)

- Generate images for posts, again via a **BYOK system** (user's own key for the
  image provider — e.g. OpenAI images, or another provider per the BYOK model).
- New AI route + a provider adapter for image generation. Needs UI in the editor
  to request, preview, regenerate, and attach an image to the post/preview.

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
