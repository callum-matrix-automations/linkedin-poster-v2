import { NextResponse } from "next/server";
import { isAuthenticated, getTokenExpiration } from "@/lib/oauth";

export async function GET() {
  try {
    const authenticated = isAuthenticated();
    const expiration = getTokenExpiration();
    return NextResponse.json({
      authenticated,
      expires_at: expiration ? expiration.toISOString() : null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to check auth status",
      },
      { status: 500 },
    );
  }
}
