import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  publishForUser,
  imageFromDraft,
} from "@/lib/linkedin/publish-service";

/**
 * Cron endpoint: publishes all scheduled posts that are now due.
 *
 * Triggered every ~5 min by a separate Railway cron service (scripts/
 * trigger-scheduled.ts), which calls this with the CRON_SECRET. There is no
 * user session — the post's owner is the draft's userId, and that user's
 * encrypted LinkedIn token is read from the DB. Not publicly callable: a wrong
 * or missing secret is rejected.
 *
 * Per-post failures are isolated (one bad post never blocks the others). On
 * success the post becomes "finished" with its LinkedIn URL; on failure it
 * becomes "failed" with the reason, keeping the content intact.
 */

// Publishing a batch (with image uploads) can take a while.
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if unconfigured
  const header =
    request.headers.get("x-cron-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return header === secret;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const due = await prisma.draft.findMany({
    where: { status: "scheduled", scheduledFor: { lte: now } },
    orderBy: { scheduledFor: "asc" },
    take: 50, // safety cap per tick
  });

  let published = 0;
  let failed = 0;

  for (const draft of due) {
    try {
      const outcome = await publishForUser(
        draft.userId,
        draft.content,
        imageFromDraft(draft),
      );

      if (outcome.kind === "ok") {
        await prisma.draft.update({
          where: { id: draft.id },
          data: {
            status: "finished",
            linkedinUrl: outcome.postUrl || null,
            failedReason: null,
          },
        });
        published++;
      } else {
        await prisma.draft.update({
          where: { id: draft.id },
          data: { status: "failed", failedReason: outcome.message },
        });
        failed++;
      }
    } catch (err) {
      // Never let one post abort the batch.
      await prisma.draft
        .update({
          where: { id: draft.id },
          data: {
            status: "failed",
            failedReason: err instanceof Error ? err.message : "Unknown error",
          },
        })
        .catch(() => {});
      failed++;
    }
  }

  return NextResponse.json({ ok: true, due: due.length, published, failed });
}
