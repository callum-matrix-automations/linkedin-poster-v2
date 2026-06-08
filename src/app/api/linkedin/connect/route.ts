import { NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import { createState } from "@/lib/linkedin/state";
import { buildAuthorizeUrl } from "@/lib/linkedin/api";

/**
 * Starts the LinkedIn connect flow: redirects the logged-in user to LinkedIn's
 * consent screen with a signed, user-bound state. This LINKS LinkedIn to the
 * already-authenticated app user — it is not a login method.
 */
export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    // Not logged in — bounce to login.
    return NextResponse.redirect(new URL("/login", baseUrl()));
  }

  const state = createState(userId);
  return NextResponse.redirect(buildAuthorizeUrl(state));
}

function baseUrl(): string {
  // Used only for the not-logged-in fallback redirect.
  return process.env.NEXTAUTH_URL || process.env.AUTH_URL || "http://localhost:3000";
}
