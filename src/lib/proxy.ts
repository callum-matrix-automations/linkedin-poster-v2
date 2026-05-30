const PROXY_URL = process.env.PROXY_URL || "http://localhost:42069";
const PROXY_API_KEY = process.env.PROXY_API_KEY;

/**
 * Build headers for a request to the Claude proxy.
 * Includes the Authorization bearer token when PROXY_API_KEY is set
 * (required when the proxy is protected, e.g. the hosted Railway proxy).
 */
export function proxyHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (PROXY_API_KEY) {
    headers["Authorization"] = `Bearer ${PROXY_API_KEY}`;
  }
  return headers;
}

export function proxyMessagesUrl(): string {
  return `${PROXY_URL}/v1/messages`;
}
