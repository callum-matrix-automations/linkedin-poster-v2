import { NextRequest, NextResponse } from "next/server";

const PROXY_URL = process.env.PROXY_URL || "http://localhost:42069";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const resp = await fetch(`${PROXY_URL}/v1/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      return NextResponse.json(
        { error: `Proxy error (${resp.status}): ${errorText}` },
        { status: resp.status },
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to reach proxy",
      },
      { status: 502 },
    );
  }
}
