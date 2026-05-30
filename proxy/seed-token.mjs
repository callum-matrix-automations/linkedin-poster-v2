#!/usr/bin/env node
/**
 * Seed the proxy's OAuth token file from environment variables before the
 * proxy starts. This lets the proxy authenticate on a server (e.g. Railway)
 * with no browser, no mounted credentials, and an ephemeral filesystem.
 *
 * Once seeded, the proxy's own auto-refresh keeps the token alive indefinitely
 * (it refreshes the access token using the refresh token and rewrites the file).
 *
 * Env vars (set these on Railway):
 *   CLAUDE_ACCESS_TOKEN   - sk-ant-oat01-... (current access token)
 *   CLAUDE_REFRESH_TOKEN  - sk-ant-ort01-... (long-lived refresh token)
 *   CLAUDE_EXPIRES_AT     - (optional) unix ms timestamp of access-token expiry.
 *                           If omitted, we set it to "expired" so the proxy
 *                           refreshes immediately on first use.
 *
 * Behaviour:
 *   - If the env vars aren't set, this is a no-op (local dev / browser auth).
 *   - If a token file already exists with a LATER expiry than what we'd seed,
 *     we leave it alone, so a live refreshed token is never clobbered on restart.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const access = process.env.CLAUDE_ACCESS_TOKEN;
const refresh = process.env.CLAUDE_REFRESH_TOKEN;

if (!access || !refresh) {
  console.log("[seed-token] No CLAUDE_ACCESS_TOKEN/CLAUDE_REFRESH_TOKEN set; skipping seed.");
  process.exit(0);
}

const expiresAt = process.env.CLAUDE_EXPIRES_AT
  ? Number(process.env.CLAUDE_EXPIRES_AT)
  : Date.now() - 1; // already-expired => proxy refreshes on first request

const dir = path.join(os.homedir(), ".claude-code-proxy");
const tokenPath = path.join(dir, "tokens.json");

try {
  if (fs.existsSync(tokenPath)) {
    const existing = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
    if (
      existing.refresh_token &&
      typeof existing.expires_at === "number" &&
      existing.expires_at > expiresAt
    ) {
      console.log(
        "[seed-token] Existing token file is newer than the seed; leaving it untouched.",
      );
      process.exit(0);
    }
  }

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    tokenPath,
    JSON.stringify(
      { access_token: access, refresh_token: refresh, expires_at: expiresAt },
      null,
      2,
    ),
    "utf8",
  );
  if (process.platform !== "win32") {
    try {
      fs.chmodSync(tokenPath, 0o600);
    } catch {
      // non-fatal
    }
  }
  console.log(`[seed-token] Wrote ${tokenPath} (proxy will refresh on first use).`);
} catch (err) {
  console.error("[seed-token] Failed to seed token:", err.message);
  // Don't crash the start command over this; the proxy can still browser-auth.
  process.exit(0);
}
