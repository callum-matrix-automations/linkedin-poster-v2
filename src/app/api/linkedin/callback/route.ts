import { NextRequest, NextResponse } from "next/server";
import { verifyState } from "@/lib/linkedin/state";
import { exchangeCodeForToken, fetchUserInfo } from "@/lib/linkedin/api";
import { saveConnection } from "@/lib/linkedin/connection";

/**
 * LinkedIn OAuth callback. Verifies the signed state (proving which logged-in
 * user started the flow), exchanges the code for a token, fetches the member's
 * sub, and stores the encrypted connection. Then redirects back to Settings
 * with a status flag for the UI.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const settings = (status: string) =>
    NextResponse.redirect(new URL(`/settings?linkedin=${status}`, url.origin));

  // User declined consent, or LinkedIn returned an error.
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return settings(oauthError === "user_cancelled_authorize" ? "cancelled" : "error");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return settings("error");

  // Verify the state binds to a real user and isn't forged/expired.
  const verified = verifyState(state);
  if (!verified) return settings("error");

  try {
    const token = await exchangeCodeForToken(code);
    const user = await fetchUserInfo(token.accessToken);
    if (!user.sub) return settings("error");
    await saveConnection(verified.userId, token, user);
    return settings("connected");
  } catch {
    return settings("error");
  }
}
