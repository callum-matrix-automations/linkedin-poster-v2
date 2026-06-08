import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/session";
import {
  getStatus,
  getConnection,
  deleteConnection,
} from "@/lib/linkedin/connection";
import { isTokenValid } from "@/lib/linkedin/api";

/**
 * GET  /api/linkedin/status        -> connection status (no token material).
 * GET  /api/linkedin/status?live=1 -> additionally verify the token still works
 *                                     against LinkedIn (used when entering the
 *                                     write phase). `valid` reflects the result.
 * DELETE /api/linkedin/status      -> disconnect (delete the connection).
 */
export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getStatus(userId);

  if (status.connected && request.nextUrl.searchParams.get("live") === "1") {
    const conn = await getConnection(userId);
    if (!conn) {
      return NextResponse.json({ ...status, connected: false, valid: false });
    }
    try {
      const valid = await isTokenValid(conn.accessToken);
      return NextResponse.json({ ...status, valid });
    } catch {
      // Network/unknown error — report connected but unknown validity.
      return NextResponse.json({ ...status, valid: null });
    }
  }

  return NextResponse.json(status);
}

export async function DELETE() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await deleteConnection(userId);
  return NextResponse.json({ connected: false });
}
