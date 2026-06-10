import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/session";
import { LINKEDIN_MAX_CHARS, type PostImage } from "@/lib/linkedin/api";
import { publishForUser } from "@/lib/linkedin/publish-service";

/**
 * Publish a post to the authenticated user's LinkedIn feed now, optionally with
 * an image. The client sends only the text (and image base64). The token is
 * read from the DB and decrypted server-side — it never crosses the wire. The
 * actual publish logic is shared with the scheduled-post cron via publishForUser.
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

  const image: PostImage | null = parsed.data.image
    ? {
        base64: parsed.data.image.base64,
        mimeType: parsed.data.image.mimeType,
        altText: parsed.data.image.altText,
      }
    : null;

  const outcome = await publishForUser(userId, parsed.data.text, image);

  if (outcome.kind === "ok") {
    return NextResponse.json({ ok: true, postUrl: outcome.postUrl });
  }
  if (outcome.kind === "reconnect") {
    return NextResponse.json(
      { error: outcome.message, code: "reconnect_required" },
      { status: 400 },
    );
  }
  return NextResponse.json({ error: outcome.message }, { status: 502 });
}
