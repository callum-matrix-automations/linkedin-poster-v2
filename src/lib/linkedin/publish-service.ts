import { getConnection } from "@/lib/linkedin/connection";
import { publishPost, LinkedInAuthError, type PostImage } from "@/lib/linkedin/api";

/**
 * Shared server-side publish logic, used by both the interactive publish route
 * and the scheduled-post cron. Resolves the user's LinkedIn connection,
 * publishes (optionally with an image), and normalizes the outcome into a
 * discriminated result the callers can act on.
 */

export type PublishOutcome =
  | { kind: "ok"; postUrl: string }
  | { kind: "reconnect"; message: string } // token missing/expired
  | { kind: "error"; message: string };

/**
 * Publish text (+ optional image) to a user's LinkedIn feed. When an image is
 * present, retries once after a short delay to dodge LinkedIn's async image
 * processing (the readiness GET is blocked for w_member_social tokens).
 */
export async function publishForUser(
  userId: string,
  text: string,
  image?: PostImage | null,
): Promise<PublishOutcome> {
  const conn = await getConnection(userId);
  if (!conn) {
    return {
      kind: "reconnect",
      message: "LinkedIn isn't connected. Connect it in Settings to post.",
    };
  }

  try {
    let result;
    if (image) {
      try {
        result = await publishPost(conn.accessToken, conn.linkedinSub, text, image);
      } catch (firstErr) {
        if (firstErr instanceof LinkedInAuthError) throw firstErr;
        await new Promise((r) => setTimeout(r, 2500));
        result = await publishPost(conn.accessToken, conn.linkedinSub, text, image);
      }
    } else {
      result = await publishPost(conn.accessToken, conn.linkedinSub, text);
    }
    return { kind: "ok", postUrl: result.postUrl };
  } catch (err) {
    if (err instanceof LinkedInAuthError) {
      return {
        kind: "reconnect",
        message: "Your LinkedIn connection has expired. Reconnect it in Settings.",
      };
    }
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Failed to post",
    };
  }
}

/** Build a PostImage from a draft row's stored image columns, or null. */
export function imageFromDraft(d: {
  imageData: string | null;
  imageMime: string | null;
  imageAlt: string | null;
}): PostImage | null {
  if (!d.imageData || !d.imageMime) return null;
  return { base64: d.imageData, mimeType: d.imageMime, altText: d.imageAlt ?? "" };
}
