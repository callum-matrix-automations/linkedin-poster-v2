import { NextRequest, NextResponse } from "next/server";
import type { UserProfile, LinkedInPost, PostSuggestion } from "@/lib/types";
import { chatCompletion } from "@/lib/ai/providers";
import { resolveProvider, ResolveError } from "@/lib/ai/resolve";
import { getUserId } from "@/lib/session";

const SYSTEM_PROMPT = `You are a LinkedIn ghostwriter. You write posts that sound like they were written by the person, not by AI. Your job is to take a post idea and turn it into a compelling LinkedIn post.

You study what makes LinkedIn posts perform well: strong hooks, short paragraphs, conversational tone, specific details over vague claims, and a clear point of view.

Writing rules:
- Start with a hook that stops the scroll. First line is everything on LinkedIn.
- Use short paragraphs (1-3 sentences each). White space is your friend.
- Write in the user's preferred tone. Match their voice, not yours.
- Be specific. Real numbers, real situations, real names beat abstract advice.
- End with something that invites engagement: a question, a challenge, or a vulnerable admission.
- No hashtags unless they're genuinely relevant (max 3, at the very end).
- No emoji spam. Zero or very sparing use only.
- No "I'm excited to announce" or "I'm thrilled to share" or any LinkedIn cliches.
- No bullet-point listicles unless the format truly serves the content.
- Keep it under 1500 characters for optimal engagement. Most viral posts are 800-1200 characters.
- If the suggestion type is "personal", weave in the user's background, stories, or contrarian views as the core of the post.
- If the suggestion type is "topical", lead with the insight or observation. The user's expertise gives it authority, but the post doesn't need to be autobiographical.

Study the inspiration posts for format patterns that worked (hook style, paragraph rhythm, engagement triggers) and apply them naturally.

Respond with ONLY the post text. No commentary, no "here's your post", no markdown formatting. Just the raw post content exactly as it should appear on LinkedIn.`;

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
  if (!posts.length) return "(No inspiration posts provided)";

  return posts
    .slice(0, 6)
    .map((post, i) => {
      const engagement = post.engagement;
      const total =
        (engagement?.likes ?? 0) +
        (engagement?.comments ?? 0) +
        (engagement?.shares ?? 0);

      return [
        `--- Post ${i + 1} ---`,
        `Engagement: ${total} total`,
        `Content:\n${post.content?.slice(0, 1000) || "(empty)"}`,
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

    const { profile, suggestion, posts } = (await request.json()) as {
      profile: UserProfile;
      suggestion: PostSuggestion;
      posts: LinkedInPost[];
    };

    if (!profile || !suggestion) {
      return NextResponse.json(
        { error: "Profile and suggestion are required" },
        { status: 400 },
      );
    }

    // Resolve the user's BYOK provider server-side. The key never came from
    // the client and is decrypted here just-in-time.
    const { provider, apiKey, model } = await resolveProvider(userId);

    const userMessage = [
      "Here is the user's profile:",
      "",
      buildUserContext(profile),
      "",
      "Here are inspiration posts to study for format and style:",
      "",
      buildInspirationContext(posts || []),
      "",
      "Write a LinkedIn post based on this idea:",
      "",
      `Title: ${suggestion.title}`,
      `Hook angle: ${suggestion.hook}`,
      `Approach: ${suggestion.angle}`,
      `Type: ${suggestion.type}`,
      "",
      "Write the post now. Raw text only, no commentary.",
    ].join("\n");

    const draft = await chatCompletion({
      provider,
      apiKey,
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      maxTokens: 4096,
    });

    return NextResponse.json({ draft });
  } catch (err) {
    if (err instanceof ResolveError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to generate draft",
      },
      { status: 500 },
    );
  }
}
