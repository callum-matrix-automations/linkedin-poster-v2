import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/session";
import { getConnection } from "@/lib/linkedin/connection";
import {
  publishTextPost,
  LinkedInAuthError,
  LINKEDIN_MAX_CHARS,
} from "@/lib/linkedin/api";

/**
 * Publish a post to the authenticated user's LinkedIn feed.
 *
 * The client sends only the text. The user's access token is read from the DB
 * and decrypted server-side — it never crosses the wire. A 401/403 from
 * LinkedIn (expired token) is surfaced with code "reconnect_required" so the UI
 * can prompt a reconnect rather than show a generic error.
 */

const bodySchema = z.object({
  text: z.string().min(1).max(LINKEDIN_MAX_CHARS),
});

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || "Invalid input";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const conn = await getConnection(userId);
  if (!conn) {
    return NextResponse.json(
      {
        error: "LinkedIn isn't connected. Connect it in Settings to post.",
        code: "reconnect_required",
      },
      { status: 400 },
    );
  }

  try {
    const result = await publishTextPost(
      conn.accessToken,
      conn.linkedinSub,
      parsed.data.text,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof LinkedInAuthError) {
      return NextResponse.json(
        {
          error:
            "Your LinkedIn connection has expired. Reconnect it in Settings.",
          code: "reconnect_required",
        },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to post" },
      { status: 502 },
    );
  }
}
