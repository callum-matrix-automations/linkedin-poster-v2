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

## Authentication: seed the token (recommended for a server)

On Railway there is no browser and no mounted `~/.claude` credentials, so the
proxy can't authenticate on its own. The reliable approach is to **seed the
proxy's token file from env vars at startup**, then let the proxy auto-refresh
it indefinitely.

`npm start` runs `proxy/seed-token.mjs` before the proxy boots. If these env vars
are set, it writes `~/.claude-code-proxy/tokens.json`; the proxy reads it and
refreshes the access token from the refresh token whenever it nears expiry.

Set on the Railway service:

```
CLAUDE_ACCESS_TOKEN=<sk-ant-oat01-... current access token>
CLAUDE_REFRESH_TOKEN=<sk-ant-ort01-... long-lived refresh token>
CLAUDE_EXPIRES_AT=<unix ms expiry; optional, omit to force an immediate refresh>
```

### Getting the token values

From a machine where you're logged into Claude Code, read
`~/.claude/.credentials.json`. The `claudeAiOauth` object has:

- `accessToken`  -> `CLAUDE_ACCESS_TOKEN`
- `refreshToken` -> `CLAUDE_REFRESH_TOKEN`
- `expiresAt`    -> `CLAUDE_EXPIRES_AT`

Or print them:

```bash
node -e "const o=require(require('os').homedir()+'/.claude/.credentials.json').claudeAiOauth; console.log('CLAUDE_ACCESS_TOKEN='+o.accessToken); console.log('CLAUDE_REFRESH_TOKEN='+o.refreshToken); console.log('CLAUDE_EXPIRES_AT='+o.expiresAt)"
```

The seed script leaves an existing, newer token file untouched, so a live
refreshed token is never clobbered on restart.

> Do **not** set `CLAUDE_OAUTH_TOKEN` (the x-api-key injection var). A stale or
> truncated value there overrides everything and causes 401s. Seeding is better
> because the proxy refreshes the token itself.

## Caveats

- **Refresh token rotation.** Anthropic may rotate the refresh token on use. The
  proxy writes the new one to its file, but a **fresh code deploy** wipes the file
  and re-seeds from your (now possibly old) env var. If you ever get 401s after a
  deploy, refresh `CLAUDE_REFRESH_TOKEN` / `CLAUDE_ACCESS_TOKEN` from a current
  `~/.claude/.credentials.json`.
- **Permanent fix.** Attach a Railway volume mounted at the proxy's token dir
  (`$HOME/.claude-code-proxy`) so the refreshed token persists across deploys and
  the seed env vars are only ever needed once.

## Alternative: browser auth via Settings

The Settings page can also drive the proxy's OAuth flow through a passthrough
(`/proxy-auth/*` -> proxy `/auth/*`): open authorization page, approve on Claude,
paste the `code#state` back. Works, but the token is lost on each deploy and must
be redone. Seeding is preferred for an unattended MVP.
