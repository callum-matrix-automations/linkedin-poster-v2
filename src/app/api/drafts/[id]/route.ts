import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import type { SavedDraft } from "@/lib/types";

function toSavedDraft(d: {
  id: string;
  content: string;
  status: string;
  suggestion: unknown;
  inspirationPosts: unknown;
  imageData: string | null;
  imageMime: string | null;
  imageAlt: string | null;
  scheduledFor: Date | null;
  linkedinUrl: string | null;
  failedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: d.id,
    content: d.content,
    status: d.status as SavedDraft["status"],
    suggestion: d.suggestion as SavedDraft["suggestion"],
    inspirationPosts: d.inspirationPosts,
    imageData: d.imageData,
    imageMime: d.imageMime,
    imageAlt: d.imageAlt,
    scheduledFor: d.scheduledFor ? d.scheduledFor.getTime() : null,
    linkedinUrl: d.linkedinUrl,
    failedReason: d.failedReason,
    createdAt: d.createdAt.getTime(),
    updatedAt: d.updatedAt.getTime(),
  };
}

const patchSchema = z.object({
  content: z.string().optional(),
  status: z.enum(["drafting", "scheduled", "finished", "failed"]).optional(),
  // Image attach/replace/remove. Send null to clear. All three move together.
  imageData: z.string().nullable().optional(),
  imageMime: z.string().nullable().optional(),
  imageAlt: z.string().nullable().optional(),
  // Scheduling: epoch ms (UTC). Send null to clear when cancelling.
  scheduledFor: z.number().nullable().optional(),
});

// GET /api/drafts/:id
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const draft = await prisma.draft.findFirst({ where: { id, userId } });
  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ draft: toSavedDraft(draft) });
}

// PATCH /api/drafts/:id  -> update content and/or status (finish = status:finished)
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 },
    );
  }

  // Ensure the draft belongs to this user before updating.
  const existing = await prisma.draft.findFirst({ where: { id, userId } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // scheduledFor arrives as epoch ms; Prisma wants a Date (or null to clear).
  const { scheduledFor, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (scheduledFor !== undefined) {
    data.scheduledFor = scheduledFor === null ? null : new Date(scheduledFor);
  }
  // Leaving the scheduled state clears any stale failure reason.
  if (rest.status && rest.status !== "failed") {
    data.failedReason = null;
  }

  const draft = await prisma.draft.update({
    where: { id },
    data,
  });

  return NextResponse.json({ draft: toSavedDraft(draft) });
}

// DELETE /api/drafts/:id
export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const result = await prisma.draft.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
