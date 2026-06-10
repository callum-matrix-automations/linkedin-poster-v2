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
}): SavedDraft {
  return {
    id: d.id,
    content: d.content,
    status: d.status as SavedDraft["status"],
    suggestion: d.suggestion as SavedDraft["suggestion"],
    inspirationPosts: d.inspirationPosts as SavedDraft["inspirationPosts"],
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

const createSchema = z.object({
  suggestion: z.object({
    title: z.string(),
    hook: z.string(),
    angle: z.string(),
    type: z.enum(["personal", "topical"]),
    // The AI returns null (not missing) when there's no inspiring post.
    inspirationPostId: z.string().nullable().optional(),
  }),
  inspirationPosts: z.array(z.any()).default([]),
  content: z.string().default(""),
});

const LIST_STATUSES = ["drafting", "scheduled", "finished", "failed"];

// GET /api/drafts?status=drafting|scheduled|finished|failed  (omit for all)
export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get("status");
  const where = {
    userId,
    ...(status && LIST_STATUSES.includes(status) ? { status } : {}),
  };

  const drafts = await prisma.draft.findMany({
    where,
    // Scheduled posts read best soonest-first; others newest-first.
    orderBy:
      status === "scheduled"
        ? { scheduledFor: "asc" }
        : { updatedAt: "desc" },
  });

  return NextResponse.json({ drafts: drafts.map(toSavedDraft) });
}

// POST /api/drafts  -> create a new drafting draft
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 },
    );
  }

  const { suggestion, inspirationPosts, content } = parsed.data;

  try {
    const draft = await prisma.draft.create({
      data: {
        userId,
        content,
        status: "drafting",
        suggestion,
        inspirationPosts,
      },
    });
    return NextResponse.json({ draft: toSavedDraft(draft) });
  } catch (err) {
    console.error("Failed to create draft:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create draft" },
      { status: 500 },
    );
  }
}

