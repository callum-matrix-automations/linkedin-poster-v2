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

## First-run authentication

1. Deploy. Wait for the build + start to finish.
2. Open the app, go to **Settings**.
3. Click to connect Claude, authorize on the Claude page, paste the
   `code#state` value back, and submit.
4. This writes the OAuth token to the shared token file; the proxy picks it up.

## Caveat: ephemeral filesystem

Railway wipes the container filesystem on each **new deploy** (code push), so the
token is lost and you must re-authenticate via Settings after deploying. The token
**auto-refreshes** and survives restarts within a deploy, so you only re-auth after
pushing new code. If this becomes a hassle, attach a Railway volume mounted at
`/root/.claude-code-proxy` (or wherever `$HOME/.claude-code-proxy` resolves) to
persist the token across deploys.
