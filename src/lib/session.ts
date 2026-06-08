import { auth } from "@/auth";

/**
 * Returns the authenticated user's id, or null if no valid session.
 * Use in route handlers to scope queries to the current user.
 */
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
