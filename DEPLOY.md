# Deploying to Railway

The Claude proxy runs **in the same container** as Next.js (via `concurrently`),
so the app reaches it over `localhost` and Railway only exposes the Next.js port.
No second service, no public port mapping for the proxy.

## How it runs

- `npm run build` builds Next.js.
- `npm start` runs **both** `next start` (on Railway's `$PORT`, exposed publicly)
  and `node proxy/server.js` (on internal `127.0.0.1:42069`).
- The proxy is bound to `127.0.0.1` (see `proxy/config.txt`), so it is only
  reachable from inside the container, never from the internet.
- Next.js AI routes call `PROXY_URL` (`http://127.0.0.1:42069`). The proxy and
  the app share `~/.claude-code-proxy/tokens.json`, so authenticating through
  the app authenticates the proxy too.

## Railway environment variables

Set these on the service:

```
PROXY_URL=http://127.0.0.1:42069
APIFY_API_TOKEN=<your apify token>
TELEGRAM_BOT_TOKEN=<your bot token>
TELEGRAM_CHAT_ID=<your chat id>
```

Do **not** set `PROXY_API_KEY` (the internal proxy is not gated).

Railway injects `PORT` automatically; `next start` reads it. The proxy stays on
42069 internally and ignores `PORT`.

### Optional: `CLAUDE_OAUTH_TOKEN` (token-injection fallback)

If you'd rather not browser-auth, set `CLAUDE_OAUTH_TOKEN` to a Claude OAuth
bearer token (`sk-ant-oat01-...`, e.g. from `~/.claude/.credentials.json`). The
app forwards it to the proxy as `x-api-key`, which the proxy uses directly as the
upstream Claude credential, skipping the file-based OAuth entirely. Note: a raw
injected token is **not refreshed**, so it expires in ~2-3 hours. Browser auth via
Settings is preferred because the proxy then refreshes the token itself.

## First-run authentication

The Settings page drives the **proxy's own** OAuth flow through a passthrough
(`/proxy-auth/*` -> internal proxy `/auth/*`). The proxy holds the PKCE state in
its long-lived process, so the login/callback pair always resolves correctly.

1. Deploy. Wait for the build + start to finish.
2. Open the app, go to **Settings**.
3. Click "Open authorization page", approve access on Claude.
4. Copy the full `code#state` string shown, paste it back in Settings, submit.
5. The proxy exchanges it and writes the token to its own store; status flips
   to Connected. The proxy auto-refreshes the token from here on.

## Caveat: ephemeral filesystem

Railway wipes the container filesystem on each **new deploy** (code push), so the
token is lost and you must re-authenticate via Settings after deploying. The token
**auto-refreshes** and survives restarts within a deploy, so you only re-auth after
pushing new code. If this becomes a hassle, attach a Railway volume mounted at
`/root/.claude-code-proxy` (or wherever `$HOME/.claude-code-proxy` resolves) to
persist the token across deploys.
