import { UserProfile, EMPTY_PROFILE, LinkedInPost, SavedDraft, SavedSearch } from "./types";

// Last search results stay client-side (transient cache, not user data).
const SEARCH_KEY = "linkedin-poster-search";

// --- Profile (DB-backed via /api/profile) ---

export async function getProfile(): Promise<UserProfile> {
  try {
    const res = await fetch("/api/profile");
    if (!res.ok) return EMPTY_PROFILE;
    const data = await res.json();
    return { ...EMPTY_PROFILE, ...data.profile };
  } catch {
    return EMPTY_PROFILE;
  }
}

export async function saveProfile(
  profile: Partial<UserProfile>,
): Promise<UserProfile> {
  const res = await fetch("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error("Failed to save profile");
  const data = await res.json();
  return { ...EMPTY_PROFILE, ...data.profile };
}

export async function updateProfile(
  updates: Partial<UserProfile>,
): Promise<UserProfile> {
  return saveProfile(updates);
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  const profile = await getProfile();
  return profile.completedOnboarding;
}

// --- Found Posts (last search) — localStorage only ---

export function getSavedSearch(): SavedSearch | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SEARCH_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveSearch(queries: string[], posts: LinkedInPost[]): void {
  const data: SavedSearch = { queries, posts, searchedAt: Date.now() };
  localStorage.setItem(SEARCH_KEY, JSON.stringify(data));
}

export function clearSearch(): void {
  localStorage.removeItem(SEARCH_KEY);
}

// --- Drafts + History (DB-backed via /api/drafts) ---

export async function getDrafts(): Promise<SavedDraft[]> {
  const res = await fetch("/api/drafts?status=drafting");
  if (!res.ok) return [];
  const data = await res.json();
  return data.drafts ?? [];
}

export async function getHistory(): Promise<SavedDraft[]> {
  const res = await fetch("/api/drafts?status=finished");
  if (!res.ok) return [];
  const data = await res.json();
  return data.drafts ?? [];
}

/** Scheduled posts plus any that fired and failed (shown together). */
export async function getScheduled(): Promise<SavedDraft[]> {
  const [schedRes, failedRes] = await Promise.all([
    fetch("/api/drafts?status=scheduled"),
    fetch("/api/drafts?status=failed"),
  ]);
  const sched = schedRes.ok ? (await schedRes.json()).drafts ?? [] : [];
  const failed = failedRes.ok ? (await failedRes.json()).drafts ?? [] : [];
  return [...sched, ...failed];
}

export async function getDraft(id: string): Promise<SavedDraft | null> {
  const res = await fetch(`/api/drafts/${id}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.draft ?? null;
}

/** Create a new drafting draft from a suggestion + inspiration posts. */
export async function createDraft(
  suggestion: SavedDraft["suggestion"],
  inspirationPosts: LinkedInPost[],
): Promise<SavedDraft> {
  const res = await fetch("/api/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ suggestion, inspirationPosts, content: "" }),
  });
  if (!res.ok) throw new Error("Failed to create draft");
  const data = await res.json();
  return data.draft;
}

/**
 * Create a draft from the user's own prompt (no inspiration search). The brief
 * becomes the primary generation instruction; the suggestion fields are
 * synthesized so the draft flows through the same machinery as search-started
 * drafts. The title is a short label derived from the brief for the drafts list.
 */
export async function createPromptDraft(brief: string): Promise<SavedDraft> {
  const trimmed = brief.trim();
  // A readable label for the drafts list / editor header.
  const firstLine = trimmed.split("\n")[0].trim();
  const title =
    firstLine.length > 60 ? firstLine.slice(0, 57).trimEnd() + "..." : firstLine || "Your idea";

  const suggestion: SavedDraft["suggestion"] = {
    title,
    hook: "",
    angle: trimmed,
    // "personal" lets the writer weave in the user's background/voice.
    type: "personal",
    brief: trimmed,
  };

  return createDraft(suggestion, []);
}

/** Update a draft's content. */
export async function updateDraftContent(
  id: string,
  content: string,
): Promise<void> {
  await fetch(`/api/drafts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

/** Attach/replace/remove a draft's image. Pass nulls to remove it. */
export async function updateDraftImage(
  id: string,
  image: { imageData: string; imageMime: string; imageAlt: string } | null,
): Promise<void> {
  const body = image
    ? { imageData: image.imageData, imageMime: image.imageMime, imageAlt: image.imageAlt }
    : { imageData: null, imageMime: null, imageAlt: null };
  await fetch(`/api/drafts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Schedule (or reschedule) a post for a UTC time (epoch ms). */
export async function scheduleDraft(
  id: string,
  scheduledForMs: number,
): Promise<void> {
  await fetch(`/api/drafts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "scheduled", scheduledFor: scheduledForMs }),
  });
}

/** Cancel a scheduled post — returns it to a normal draft. */
export async function cancelScheduledDraft(id: string): Promise<void> {
  await fetch(`/api/drafts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "drafting", scheduledFor: null }),
  });
}

export async function deleteDraft(id: string): Promise<void> {
  await fetch(`/api/drafts/${id}`, { method: "DELETE" });
}

/** Mark a draft as finished (moves it to history). */
export async function finishDraft(id: string): Promise<void> {
  await fetch(`/api/drafts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "finished" }),
  });
}

export async function deleteHistoryItem(id: string): Promise<void> {
  await deleteDraft(id);
}
