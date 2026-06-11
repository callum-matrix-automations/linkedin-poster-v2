import { NextRequest, NextResponse } from "next/server";
import type { UserProfile } from "@/lib/types";
import { ResolveError } from "@/lib/ai/resolve";
import { runChat } from "@/lib/ai/run";
import { getUserId } from "@/lib/session";

/**
 * Hashtag agent. Generates 3–5 relevant LinkedIn hashtags for a post and
 * returns them as an array of tag strings (without the leading #).
 */

const SYSTEM_PROMPT = `You generate hashtags for LinkedIn posts. Given the post text and the author's profile, you return a small set of highly relevant hashtags that improve discoverability without looking spammy.

Rules:
- Return 3 to 5 hashtags. Fewer, well-chosen tags beat many generic ones.
- Mix specificity: a couple of broad industry tags plus one or two niche/topical ones tied to the post's actual subject.
- Use established, real hashtags people actually follow — not invented or overly long phrases.
- CamelCase multi-word tags (e.g. ProductLeadership, B2BSales).
- No spaces, no punctuation, no emojis inside tags.
- Respond with ONLY a raw JSON array of strings, each WITHOUT the leading "#". No markdown, no commentary. Example: ["Leadership","B2BSales","SaaS"]`;

function buildUserContext(profile: UserProfile): string {
  const parts: string[] = [];
  if (profile.industry) parts.push(`Industry: ${profile.industry}`);
  if (profile.targetAudience) parts.push(`Audience: ${profile.targetAudience}`);
  if (profile.expertise) parts.push(`Expertise: ${profile.expertise}`);
  return parts.length ? parts.join("\n") : "(no profile details)";
}

// Keep a hashtag to safe characters and a sane length.
function sanitizeTag(raw: string): string | null {
  const cleaned = raw.replace(/^#+/, "").replace(/[^A-Za-z0-9]/g, "");
  if (!cleaned || cleaned.length > 40) return null;
  return cleaned;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { content, profile, proxyText } = (await request.json()) as {
      content: string;
      profile: UserProfile;
      proxyText?: string;
    };

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "Post content is required" },
        { status: 400 },
      );
    }

    const userMessage = [
      "Author profile:",
      buildUserContext(profile),
      "",
      "Post:",
      "---",
      content.slice(0, 4000),
      "---",
      "",
      "Generate 3-5 hashtags. Respond with ONLY a raw JSON array of strings, no leading # and no markdown.",
    ].join("\n");

    const result = await runChat(
      userId,
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      512,
      proxyText,
    );
    if (result.deferred) {
      return NextResponse.json(result.payload);
    }
    const text = result.text;

    let parsed: unknown;
    try {
      const cleaned = text
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse hashtags from AI response", raw: text },
        { status: 502 },
      );
    }

    if (!Array.isArray(parsed)) {
      return NextResponse.json(
        { error: "AI response was not an array", raw: text },
        { status: 502 },
      );
    }

    const hashtags = parsed
      .filter((t): t is string => typeof t === "string")
      .map(sanitizeTag)
      .filter((t): t is string => t !== null)
      .slice(0, 5);

    if (hashtags.length === 0) {
      return NextResponse.json(
        { error: "No valid hashtags were generated" },
        { status: 502 },
      );
    }

    return NextResponse.json({ hashtags });
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
          err instanceof Error ? err.message : "Failed to generate hashtags",
      },
      { status: 500 },
    );
  }
}
