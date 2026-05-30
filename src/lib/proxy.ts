const PROXY_URL = process.env.PROXY_URL || "http://localhost:42069";

// Gate password for a protected proxy (sent as `Authorization: Bearer`).
// Only needed when the proxy has its own API_KEY set. Not needed for the
// co-located internal proxy.
const PROXY_API_KEY = process.env.PROXY_API_KEY;

// The Claude OAuth bearer token (sk-ant-oat01-...). The proxy detects an
// x-api-key containing "sk-ant" and uses it directly as the upstream Claude
// credential, bypassing the file-based OAuth flow. This is the reliable way
// to authenticate the proxy on a server where the token file is ephemeral.
const CLAUDE_OAUTH_TOKEN = process.env.CLAUDE_OAUTH_TOKEN;

/**
 * Build headers for a request to the Claude proxy.
 */
export function proxyHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (PROXY_API_KEY) {
    headers["Authorization"] = `Bearer ${PROXY_API_KEY}`;
  }
  if (CLAUDE_OAUTH_TOKEN) {
    headers["x-api-key"] = CLAUDE_OAUTH_TOKEN;
  }
  return headers;
}

export function proxyMessagesUrl(): string {
  return `${PROXY_URL}/v1/messages`;
}
