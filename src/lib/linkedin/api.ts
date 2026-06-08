/**
 * Server-side LinkedIn API client for the standalone OAuth connect + post flow.
 *
 * Endpoints and shapes are per LinkedIn's current docs (mid-2026):
 *   - OAuth:    https://www.linkedin.com/oauth/v2/{authorization,accessToken}
 *   - Userinfo: https://api.linkedin.com/v2/userinfo  (OIDC "sub" = member id)
 *   - Posts:    https://api.linkedin.com/rest/posts    (replaces ugcPosts)
 *
 * Nothing here reads the DB — callers pass the (decrypted) access token in.
 */

// Scopes: openid/profile/email (Sign in with OpenID Connect) + w_member_social
// (Share on LinkedIn, the posting permission).
export const LINKEDIN_SCOPE = "openid profile email w_member_social";

// Posts API monthly version (YYYYMM). 202605 is current; bump periodically.
const LINKEDIN_VERSION = "202605";

function clientId(): string {
  const v = process.env.LINKEDIN_CLIENT_ID;
  if (!v) throw new Error("LINKEDIN_CLIENT_ID is not configured");
  return v;
}
function clientSecret(): string {
  const v = process.env.LINKEDIN_CLIENT_SECRET;
  if (!v) throw new Error("LINKEDIN_CLIENT_SECRET is not configured");
  return v;
}
function redirectUri(): string {
  const v = process.env.LINKEDIN_REDIRECT_URI;
  if (!v) throw new Error("LINKEDIN_REDIRECT_URI is not configured");
  return v;
}

/** Build the authorization URL the user is redirected to for consent. */
export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId(),
    redirect_uri: redirectUri(),
    state,
    scope: LINKEDIN_SCOPE,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

export interface TokenResponse {
  accessToken: string;
  expiresInSec: number;
  refreshToken: string | null;
  scope: string;
}

/** Exchange an authorization code for an access token. */
export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri(),
  });

  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Token exchange failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresInSec: data.expires_in ?? 0,
    refreshToken: data.refresh_token ?? null,
    scope: data.scope ?? "",
  };
}

export interface LinkedInUser {
  sub: string; // member id used to build urn:li:person:{sub}
  name: string;
  email?: string;
}

/** Fetch the member's OIDC profile (sub = author id). */
export async function fetchUserInfo(accessToken: string): Promise<LinkedInUser> {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new LinkedInAuthError(
      `Failed to fetch LinkedIn profile (${res.status}): ${text.slice(0, 200)}`,
      res.status,
    );
  }
  const data = await res.json();
  return {
    sub: data.sub,
    name: data.name ?? "",
    email: data.email,
  };
}

/**
 * Thrown when LinkedIn rejects the token (401/403) — the signal to prompt a
 * reconnect rather than treat it as a generic failure.
 */
export class LinkedInAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "LinkedInAuthError";
    this.status = status;
  }
}

/**
 * Escape text for LinkedIn's "little" text format. All of these reserved
 * characters must be backslash-escaped when used as literal text, or LinkedIn
 * misparses them (e.g. as mention/hashtag syntax) or rejects the post.
 * Reserved: |  {  }  @  [  ]  (  )  <  >  #  \  *  _  ~
 */
export function escapeLittleText(text: string): string {
  return text.replace(/[|{}@[\]()<>#\\*_~]/g, "\\$&");
}

export const LINKEDIN_MAX_CHARS = 3000;

export interface PublishResult {
  postUrn: string;
  postUrl: string;
}

/**
 * Publish a plain-text post to the member's feed via the Posts API.
 * `authorSub` is the OIDC sub; visibility is always PUBLIC for this tool.
 * Throws LinkedInAuthError on 401/403 (token expired/insufficient).
 */
export async function publishTextPost(
  accessToken: string,
  authorSub: string,
  text: string,
): Promise<PublishResult> {
  const author = `urn:li:person:${authorSub}`;
  const body = {
    author,
    commentary: escapeLittleText(text),
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": LINKEDIN_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401 || res.status === 403) {
    throw new LinkedInAuthError(
      "LinkedIn rejected the request — your connection has expired.",
      res.status,
    );
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LinkedIn post failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  // The created post URN comes back in the x-restli-id header, not the body.
  const postUrn = res.headers.get("x-restli-id") || res.headers.get("x-linkedin-id") || "";
  return {
    postUrn,
    postUrl: postUrn ? `https://www.linkedin.com/feed/update/${postUrn}` : "",
  };
}

/**
 * Lightweight liveness check: hit userinfo to see if the token still works.
 * Returns true if valid, false if LinkedIn rejected it (expired/revoked).
 */
export async function isTokenValid(accessToken: string): Promise<boolean> {
  try {
    await fetchUserInfo(accessToken);
    return true;
  } catch (err) {
    if (err instanceof LinkedInAuthError) return false;
    // Network/other errors: treat as "unknown" but don't claim invalid.
    throw err;
  }
}
