import { NextRequest, NextResponse } from "next/server";
import type { UserProfile, LinkedInPost, PostSuggestion } from "@/lib/types";
import { ResolveError } from "@/lib/ai/resolve";
import { runChat } from "@/lib/ai/run";
import { getUserId } from "@/lib/session";

const SYSTEM_PROMPT = `You are a LinkedIn post strategist. Your job is to analyze high-performing LinkedIn posts and a user's profile to suggest post ideas that will resonate with their audience.

You think like a content strategist, not a content mill. Every suggestion should be informed by proven formats from the inspiration posts.

There are two types of suggestions you produce:

1. PERSONAL posts (~50% of suggestions): These weave in the user's unique background, contrarian views, personal stories, or unconventional career path. These are posts only this person could write. They draw on what makes them different.

2. TOPICAL posts (~50% of suggestions): These are about the user's industry, audience, or the topics from the inspiration posts. They reflect the user's expertise and tone but don't require personal anecdotes or background details. Think: industry observations, frameworks, hot takes on trends, tactical advice.

Both types should feel authentic to the user's voice and target audience. The difference is whether the post leans on personal narrative or topical authority.

Rules:
- Generate exactly the number of suggestions requested (default 5)
- Roughly half should be PERSONAL, half TOPICAL. Alternate them in the output.
- Each suggestion must have a clear, specific title (the kind of hook that makes someone stop scrolling)
- Each suggestion must have a hook explaining the opening angle in 1-2 sentences
- Each suggestion must have an angle explaining why this post would work and whether it's personal or topical
- Each suggestion must have a type field: "personal" or "topical"
- Titles should be provocative, specific, or contrarian. Never generic ("5 Tips for Success")
- Study what made the inspiration posts successful (format, hook style, engagement pattern) and apply those patterns
- Mix formats: stories, contrarian takes, frameworks, lessons learned, observations
- If an idea was inspired by a specific post, reference it

Respond with ONLY a JSON array of suggestion objects. No markdown, no explanation, no wrapping. Just the raw JSON array.

Each object must have these fields:
- "title": string (the post headline/hook, max 80 chars)
- "hook": string (1-2 sentence opening angle)
- "angle": string (why this works for this person, and whether it draws on their background or topical authority)
- "type": "personal" | "topical"
- "inspirationPostId": string | null (the id of the inspiration post that sparked this idea, or null)`;

function buildUserContext(profile: UserProfile): string {
  const parts = [
    `Name: ${profile.name}`,
    `Title: ${profile.title}`,
    `Industry: ${profile.industry}`,
    `Target audience: ${profile.targetAudience}`,
    `Preferred tone: ${profile.tone}`,
  ];

  if (profile.uniqueBackground) {
    parts.push(`Unique background: ${profile.uniqueBackground}`);
  }
  if (profile.contrarian) {
    parts.push(`Contrarian view: ${profile.contrarian}`);
  }
  if (profile.personalStory) {
    parts.push(`Personal story: ${profile.personalStory}`);
  }
  if (profile.expertise) {
    parts.push(`Key expertise: ${profile.expertise}`);
  }

  return parts.join("\n");
}

function buildInspirationContext(posts: LinkedInPost[]): string {
  return posts
    .map((post, i) => {
      const engagement = post.engagement;
      const total =
        (engagement?.likes ?? 0) +
        (engagement?.comments ?? 0) +
        (engagement?.shares ?? 0);

      return [
        `--- Post ${i + 1} (ID: ${post.id}) ---`,
        `Author: ${post.author?.name} (${post.author?.info || "no headline"})`,
        `Engagement: ${total} total (${engagement?.likes ?? 0} likes, ${engagement?.comments ?? 0} comments, ${engagement?.shares ?? 0} shares)`,
        `Posted: ${post.postedAt?.postedAgoShort || "unknown"}`,
        `Content:\n${post.content?.slice(0, 1500) || "(empty)"}`,
      ].join("\n");
    })
    .join("\n\n");
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { profile, posts, count = 6, proxyText } = (await request.json()) as {
      profile: UserProfile;
      posts: LinkedInPost[];
      count?: number;
      proxyText?: string;
    };

    if (!profile || !posts?.length) {
      return NextResponse.json(
        { error: "Profile and at least one inspiration post are required" },
        { status: 400 },
      );
    }

    const userMessage = [
      "Here is the user's profile:",
      "",
      buildUserContext(profile),
      "",
      `Here are ${posts.length} high-performing LinkedIn posts for inspiration:`,
      "",
      buildInspirationContext(posts),
      "",
      `Generate ${count} post suggestions for this person. Remember: respond with ONLY a raw JSON array, no markdown fences.`,
    ].join("\n");

    const result = await runChat(
      userId,
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      4096,
      proxyText,
    );
    // Local Claude: defer; the client resubmits proxyText for parsing below.
    if (result.deferred) {
      return NextResponse.json(result.payload);
    }
    const text = result.text;

    let suggestions: PostSuggestion[];
    try {
      const cleaned = text
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      suggestions = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response as JSON", raw: text },
        { status: 502 },
      );
    }

    if (!Array.isArray(suggestions)) {
      return NextResponse.json(
        { error: "AI response was not an array", raw: text },
        { status: 502 },
      );
    }

    return NextResponse.json({ suggestions });
  } catch (err) {
    if (err instanceof ResolveError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to generate suggestions",
      },
      { status: 500 },
    );
  }
}
