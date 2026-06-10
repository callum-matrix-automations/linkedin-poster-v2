import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/session";
import { getConnection } from "@/lib/linkedin/connection";
import {
  publishPost,
  LinkedInAuthError,
  LINKEDIN_MAX_CHARS,
  type PostImage,
} from "@/lib/linkedin/api";

/**
 * Publish a post to the authenticated user's LinkedIn feed, optionally with an
 * image. The client sends only the text (and, if attaching, the image base64).
 * The LinkedIn access token is read from the DB and decrypted server-side — it
 * never crosses the wire. A 401/403 from LinkedIn (expired token) is surfaced
 * with code "reconnect_required" so the UI can prompt a reconnect.
 */

// Image upload + post can take a little while; allow headroom.
export const maxDuration = 60;

const bodySchema = z.object({
  text: z.string().min(1).max(LINKEDIN_MAX_CHARS),
  image: z
    .object({
      base64: z.string().min(1),
      mimeType: z.string().min(1),
      altText: z.string().optional(),
    })
    .nullable()
    .optional(),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

  const image: PostImage | null = parsed.data.image
    ? {
        base64: parsed.data.image.base64,
        mimeType: parsed.data.image.mimeType,
        altText: parsed.data.image.altText,
      }
    : null;

  try {
    // LinkedIn processes uploaded images asynchronously and the readiness GET
    // is blocked for w_member_social tokens, so when an image is attached we
    // give it a brief moment after upload and retry the post once if the first
    // attempt fails (which can happen if the image isn't AVAILABLE yet).
    let result;
    if (image) {
      try {
        result = await publishPost(conn.accessToken, conn.linkedinSub, parsed.data.text, image);
      } catch (firstErr) {
        if (firstErr instanceof LinkedInAuthError) throw firstErr;
        await sleep(2500);
        result = await publishPost(conn.accessToken, conn.linkedinSub, parsed.data.text, image);
      }
    } else {
      result = await publishPost(conn.accessToken, conn.linkedinSub, parsed.data.text);
    }
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
