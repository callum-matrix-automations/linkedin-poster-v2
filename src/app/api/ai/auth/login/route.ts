import { NextResponse } from "next/server";
import { generatePKCE, buildAuthorizationURL } from "@/lib/oauth";

export async function GET() {
  try {
    const pkce = generatePKCE();
    const url = buildAuthorizationURL(pkce);
    return NextResponse.json({ url, state: pkce.state });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to generate auth URL",
      },
      { status: 500 },
    );
  }
}
