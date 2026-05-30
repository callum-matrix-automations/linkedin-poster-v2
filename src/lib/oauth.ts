import crypto from "crypto";
import fs from "fs";
import path from "path";

const OAUTH_CONFIG = {
  client_id: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
  authorize_url: "https://claude.ai/oauth/authorize",
  token_url: "https://console.anthropic.com/v1/oauth/token",
  redirect_uri: "https://console.anthropic.com/oauth/code/callback",
  scope: "org:create_api_key user:profile user:inference",
};

const TOKEN_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || "",
  ".claude-code-proxy",
);
const TOKEN_PATH = path.join(TOKEN_DIR, "tokens.json");

interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface PKCEValues {
  code_verifier: string;
  code_challenge: string;
  state: string;
}

let cachedToken: string | null = null;
let refreshPromise: Promise<void> | null = null;
let pendingPKCE: PKCEValues | null = null;

function loadTokens(): Tokens | null {
  try {
    if (!fs.existsSync(TOKEN_PATH)) return null;
    const data = fs.readFileSync(TOKEN_PATH, "utf8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function saveTokens(tokens: Tokens): void {
  if (!fs.existsSync(TOKEN_DIR)) {
    fs.mkdirSync(TOKEN_DIR, { recursive: true });
  }
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf8");
  if (process.platform !== "win32") {
    fs.chmodSync(TOKEN_PATH, 0o600);
  }
}

async function makeTokenRequest(
  payload: Record<string, string>,
): Promise<Record<string, unknown>> {
  const res = await fetch(OAUTH_CONFIG.token_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token request failed (${res.status}): ${text}`);
  }
  return res.json();
}

export function generatePKCE(): PKCEValues {
  const code_verifier = crypto.randomBytes(32).toString("base64url");
  const code_challenge = crypto
    .createHash("sha256")
    .update(code_verifier)
    .digest("base64url");
  const state = crypto.randomBytes(32).toString("base64url");
  pendingPKCE = { code_verifier, code_challenge, state };
  return pendingPKCE;
}

export function buildAuthorizationURL(pkce: PKCEValues): string {
  const params = new URLSearchParams({
    code: "true",
    client_id: OAUTH_CONFIG.client_id,
    response_type: "code",
    redirect_uri: OAUTH_CONFIG.redirect_uri,
    scope: OAUTH_CONFIG.scope,
    code_challenge: pkce.code_challenge,
    code_challenge_method: "S256",
    state: pkce.state,
  });
  return `${OAUTH_CONFIG.authorize_url}?${params.toString()}`;
}

export function getPendingPKCE(): PKCEValues | null {
  return pendingPKCE;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  state: string,
): Promise<void> {
  const response = await makeTokenRequest({
    grant_type: "authorization_code",
    code,
    state,
    client_id: OAUTH_CONFIG.client_id,
    code_verifier: codeVerifier,
    redirect_uri: OAUTH_CONFIG.redirect_uri,
  });
  const tokens: Tokens = {
    access_token: response.access_token as string,
    refresh_token: response.refresh_token as string,
    expires_at: Date.now() + (response.expires_in as number) * 1000,
  };
  saveTokens(tokens);
  cachedToken = tokens.access_token;
}

async function refreshAccessToken(): Promise<void> {
  if (refreshPromise) {
    await refreshPromise;
    return;
  }
  refreshPromise = (async () => {
    try {
      const tokens = loadTokens();
      if (!tokens?.refresh_token) throw new Error("No refresh token available");
      const response = await makeTokenRequest({
        grant_type: "refresh_token",
        refresh_token: tokens.refresh_token,
        client_id: OAUTH_CONFIG.client_id,
      });
      const newTokens: Tokens = {
        access_token: response.access_token as string,
        refresh_token:
          (response.refresh_token as string) || tokens.refresh_token,
        expires_at: Date.now() + (response.expires_in as number) * 1000,
      };
      saveTokens(newTokens);
      cachedToken = newTokens.access_token;
    } finally {
      refreshPromise = null;
    }
  })();
  await refreshPromise;
}

export async function getValidAccessToken(): Promise<string> {
  if (cachedToken) {
    const tokens = loadTokens();
    if (tokens && tokens.expires_at > Date.now() + 60000) {
      return cachedToken;
    }
  }
  const tokens = loadTokens();
  if (!tokens) throw new Error("Not authenticated. Please log in first.");
  if (tokens.expires_at <= Date.now() + 60000) {
    await refreshAccessToken();
    const newTokens = loadTokens();
    if (!newTokens) throw new Error("Failed to refresh token");
    cachedToken = newTokens.access_token;
    return cachedToken;
  }
  cachedToken = tokens.access_token;
  return tokens.access_token;
}

export function isAuthenticated(): boolean {
  const tokens = loadTokens();
  if (!tokens?.access_token || !tokens?.refresh_token) return false;
  if (tokens.expires_at && tokens.expires_at <= Date.now()) return false;
  return true;
}

export function getTokenExpiration(): Date | null {
  const tokens = loadTokens();
  if (!tokens?.expires_at) return null;
  return new Date(tokens.expires_at);
}

export function logout(): void {
  try {
    if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH);
    cachedToken = null;
  } catch {
    // ignore
  }
}
