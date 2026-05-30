import { NextRequest, NextResponse } from "next/server";

const PROXY_URL = process.env.PROXY_URL || "http://localhost:42069";

/**
 * Thin JSON passthrough to the co-located Claude proxy's auth endpoints:
 *   /proxy-auth/auth/get-url   -> proxy /auth/get-url  (start OAuth, returns {url,state})
 *   /proxy-auth/auth/callback  -> proxy /auth/callback (completes OAuth)
 *   /proxy-auth/auth/status    -> proxy /auth/status
 *   /proxy-auth/auth/logout    -> proxy /auth/logout
 *
 * The proxy holds PKCE state in its own long-lived process memory, so the
 * login/callback pair always resolves correctly. We only proxy JSON here;
 * the Settings page provides the UI.
 */
async function handle(req: NextRequest, path: string[]) {
  const sub = path.length ? `/${path.join("/")}` : "/";
  const search = req.nextUrl.search || "";
  const target = `${PROXY_URL}${sub}${search}`;

  const init: RequestInit = {
    method: req.method,
    headers: { "Content-Type": "application/json" },
    redirect: "manual",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }

  try {
    const upstream = await fetch(target, init);
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Proxy unreachable: ${err.message}`
            : "Proxy unreachable",
      },
      { status: 502 },
    );
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await ctx.params;
  return handle(req, path);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await ctx.params;
  return handle(req, path);
}
