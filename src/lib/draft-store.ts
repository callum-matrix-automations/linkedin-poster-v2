import type { PostSuggestion, LinkedInPost } from "./types";

const DRAFT_KEY = "linkedin-poster-draft-context";
const CURRENT_DRAFT_KEY = "linkedin-poster-current-draft";

export interface DraftContext {
  suggestion: PostSuggestion;
  inspirationPosts: LinkedInPost[];
}

export function saveDraftContext(context: DraftContext): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(context));
}

export function loadDraftContext(): DraftContext | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearDraftContext(): void {
  localStorage.removeItem(DRAFT_KEY);
}

export function saveCurrentDraft(draft: string): void {
  localStorage.setItem(CURRENT_DRAFT_KEY, draft);
}

export function loadCurrentDraft(): string {
  return localStorage.getItem(CURRENT_DRAFT_KEY) || "";
}

export function clearCurrentDraft(): void {
  localStorage.removeItem(CURRENT_DRAFT_KEY);
}
