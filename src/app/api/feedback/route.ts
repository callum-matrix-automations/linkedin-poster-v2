import { NextRequest, NextResponse } from "next/server";

interface FeedbackRequest {
  type: "bug" | "idea" | "other";
  message: string;
  page?: string;
  name?: string;
}

const TYPE_LABELS: Record<string, string> = {
  bug: "🐛 Bug",
  idea: "💡 Idea",
  other: "💬 Other",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(request: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return NextResponse.json(
      { error: "Feedback channel not configured" },
      { status: 500 },
    );
  }

  let body: FeedbackRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body.message?.trim()) {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 },
    );
  }

  const typeLabel = TYPE_LABELS[body.type] || "💬 Feedback";

  const lines = [
    `<b>${typeLabel}</b>`,
    "",
    escapeHtml(body.message.trim()),
  ];

  const meta: string[] = [];
  if (body.name?.trim()) meta.push(`From: ${escapeHtml(body.name.trim())}`);
  if (body.page) meta.push(`Page: ${escapeHtml(body.page)}`);
  if (meta.length) {
    lines.push("", `<i>${meta.join(" · ")}</i>`);
  }

  const text = lines.join("\n");

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: "Failed to deliver feedback", detail },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to send feedback",
      },
      { status: 502 },
    );
  }
}
