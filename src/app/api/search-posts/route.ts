import { NextRequest } from "next/server";
import type { SearchPostsRequest } from "@/lib/types";

const ACTOR_ID = "harvestapi~linkedin-post-search";
const MAX_POSTS = 50;

export async function POST(request: NextRequest) {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    return Response.json(
      { error: "Apify API token not configured" },
      { status: 500 },
    );
  }

  const body: SearchPostsRequest = await request.json();

  if (!body.searchQueries?.length) {
    return Response.json(
      { error: "At least one search query is required" },
      { status: 400 },
    );
  }

  const input: Record<string, unknown> = {
    searchQueries: body.searchQueries,
    maxPosts: MAX_POSTS,
    sortBy: body.sortBy ?? "relevance",
    postedLimit: body.postedLimit ?? "month",
    scrapeReactions: false,
    scrapeComments: false,
  };

  if (body.targetUrls?.length) {
    input.targetUrls = body.targetUrls;
  }
  if (body.authorsPublicIdentifiers?.length) {
    input.authorsPublicIdentifiers = body.authorsPublicIdentifiers;
  }
  if (body.authorsCompanyPublicIdentifiers?.length) {
    input.authorsCompanyPublicIdentifiers = body.authorsCompanyPublicIdentifiers;
  }

  const runUrl = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${token}`;

  const res = await fetch(runUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text();
    return Response.json(
      { error: "Apify API request failed", details: text },
      { status: res.status },
    );
  }

  const posts = await res.json();

  const seen = new Set<string>();
  const filtered = Array.isArray(posts)
    ? posts.filter((p: { type?: string; id?: string }) => {
        if (p.type !== "post" || !p.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
    : [];

  return Response.json({ posts: filtered });
}
