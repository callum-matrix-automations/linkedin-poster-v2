import { NextRequest, NextResponse } from "next/server";
import { getPendingPKCE, exchangeCodeForTokens } from "@/lib/oauth";

export async function POST(request: NextRequest) {
  try {
    const { code, state } = await request.json();

    if (!code || !state) {
      return NextResponse.json(
        { error: "Missing authorization code or state" },
        { status: 400 },
      );
    }

    const pkce = getPendingPKCE();
    if (!pkce || pkce.state !== state) {
      return NextResponse.json(
        { error: "Invalid or expired state. Please start login again." },
        { status: 400 },
      );
    }

    await exchangeCodeForTokens(code, pkce.code_verifier, state);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Authentication failed",
      },
      { status: 500 },
    );
  }
}
