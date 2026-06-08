import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { EMPTY_PROFILE } from "@/lib/types";

const profileSchema = z.object({
  name: z.string().max(200).optional(),
  title: z.string().max(200).optional(),
  industry: z.string().max(200).optional(),
  targetAudience: z.string().max(500).optional(),
  uniqueBackground: z.string().max(2000).optional(),
  contrarian: z.string().max(2000).optional(),
  personalStory: z.string().max(2000).optional(),
  expertise: z.string().max(2000).optional(),
  tone: z.string().max(200).optional(),
  completedOnboarding: z.boolean().optional(),
});

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({ where: { userId } });

  // Always return a complete profile shape (empty if not created yet).
  const data = profile
    ? {
        name: profile.name,
        title: profile.title,
        industry: profile.industry,
        targetAudience: profile.targetAudience,
        uniqueBackground: profile.uniqueBackground,
        contrarian: profile.contrarian,
        personalStory: profile.personalStory,
        expertise: profile.expertise,
        tone: profile.tone,
        completedOnboarding: profile.completedOnboarding,
      }
    : EMPTY_PROFILE;

  return NextResponse.json({ profile: data });
}

export async function PUT(request: NextRequest) {
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

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 },
    );
  }

  const data = parsed.data;

  let profile;
  try {
    profile = await prisma.profile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to save profile",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    profile: {
      name: profile.name,
      title: profile.title,
      industry: profile.industry,
      targetAudience: profile.targetAudience,
      uniqueBackground: profile.uniqueBackground,
      contrarian: profile.contrarian,
      personalStory: profile.personalStory,
      expertise: profile.expertise,
      tone: profile.tone,
      completedOnboarding: profile.completedOnboarding,
    },
  });
}
