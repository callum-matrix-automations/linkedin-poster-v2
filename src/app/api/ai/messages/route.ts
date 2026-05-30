import { NextRequest, NextResponse } from "next/server";
import { proxyHeaders, proxyMessagesUrl } from "@/lib/proxy";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const resp = await fetch(proxyMessagesUrl(), {
      method: "POST",
      headers: proxyHeaders(),
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
