import { UserProfile, EMPTY_PROFILE, LinkedInPost, SavedDraft, SavedSearch } from "./types";

const PROFILE_KEY = "linkedin-poster-profile";
const SEARCH_KEY = "linkedin-poster-search";
const DRAFTS_KEY = "linkedin-poster-drafts";
const HISTORY_KEY = "linkedin-poster-history";

// --- Profile ---

export function getProfile(): UserProfile {
  if (typeof window === "undefined") return EMPTY_PROFILE;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return EMPTY_PROFILE;
    return { ...EMPTY_PROFILE, ...JSON.parse(raw) };
  } catch {
    return EMPTY_PROFILE;
  }
}

export function saveProfile(profile: UserProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function updateProfile(updates: Partial<UserProfile>): UserProfile {
  const current = getProfile();
  const updated = { ...current, ...updates };
  saveProfile(updated);
  return updated;
}

export function hasCompletedOnboarding(): boolean {
  return getProfile().completedOnboarding;
}

// --- Found Posts (last search) ---

export function getSavedSearch(): SavedSearch | null {
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

// --- Drafts (in progress) ---

function loadDrafts(): SavedDraft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeDrafts(drafts: SavedDraft[]): void {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

export function getDrafts(): SavedDraft[] {
  return loadDrafts().filter((d) => d.status === "drafting");
}

export function getDraft(id: string): SavedDraft | null {
  return loadDrafts().find((d) => d.id === id) || null;
}

export function saveDraft(draft: SavedDraft): void {
  const drafts = loadDrafts();
  const index = drafts.findIndex((d) => d.id === draft.id);
  if (index >= 0) {
    drafts[index] = { ...draft, updatedAt: Date.now() };
  } else {
    drafts.push(draft);
  }
  writeDrafts(drafts);
}

export function deleteDraft(id: string): void {
  writeDrafts(loadDrafts().filter((d) => d.id !== id));
}

export function generateDraftId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// --- History (finished posts) ---

function loadHistory(): SavedDraft[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeHistory(history: SavedDraft[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function getHistory(): SavedDraft[] {
  return loadHistory().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function finishDraft(id: string): void {
  const drafts = loadDrafts();
  const draft = drafts.find((d) => d.id === id);
  if (!draft) return;

  draft.status = "finished";
  draft.updatedAt = Date.now();

  writeDrafts(drafts.filter((d) => d.id !== id));

  const history = loadHistory();
  history.push(draft);
  writeHistory(history);
}

export function deleteHistoryItem(id: string): void {
  writeHistory(loadHistory().filter((d) => d.id !== id));
}
