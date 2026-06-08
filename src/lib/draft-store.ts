// The in-editor scratch buffer for the draft currently being written.
// Inspiration posts now live on the draft row in the DB (see SavedDraft).
const CURRENT_DRAFT_KEY = "linkedin-poster-current-draft";

export function saveCurrentDraft(draft: string): void {
  localStorage.setItem(CURRENT_DRAFT_KEY, draft);
}

export function loadCurrentDraft(): string {
  return localStorage.getItem(CURRENT_DRAFT_KEY) || "";
}

export function clearCurrentDraft(): void {
  localStorage.removeItem(CURRENT_DRAFT_KEY);
}
