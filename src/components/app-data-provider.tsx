"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  getProfile,
  saveProfile as apiSaveProfile,
  getDrafts as apiGetDrafts,
  getHistory as apiGetHistory,
} from "@/lib/storage";
import { EMPTY_PROFILE } from "@/lib/types";
import type { UserProfile, SavedDraft } from "@/lib/types";

/**
 * In-memory, stale-while-revalidate cache for the per-user data that the app
 * reads on nearly every screen (profile, drafts, history). Mounted once above
 * the router inside (app)/layout.tsx, so tab navigation reads from the cache
 * instead of re-fetching — killing the blank-flash stickiness.
 *
 * Pattern: the first consumer of each slice triggers a fetch; results are
 * cached. Subsequent reads return the cached value instantly. Mutators update
 * the cache in place so saves don't require a refetch.
 */

interface AppDataValue {
  // --- profile ---
  profile: UserProfile | null; // null = not loaded yet
  profileLoading: boolean;
  saveProfile: (updates: Partial<UserProfile>) => Promise<UserProfile>;
  refreshProfile: () => Promise<void>;

  // --- drafts (status: drafting) ---
  drafts: SavedDraft[] | null;
  draftsLoading: boolean;
  ensureDrafts: () => void; // lazy first-load trigger
  refreshDrafts: () => Promise<void>;
  removeDraftFromCache: (id: string) => void;

  // --- history (status: finished) ---
  history: SavedDraft[] | null;
  historyLoading: boolean;
  ensureHistory: () => void; // lazy first-load trigger
  refreshHistory: () => Promise<void>;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [drafts, setDrafts] = useState<SavedDraft[] | null>(null);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [history, setHistory] = useState<SavedDraft[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Guards so concurrent consumers don't each kick off a fetch.
  const profileFetched = useRef(false);
  const draftsFetched = useRef(false);
  const historyFetched = useRef(false);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      setProfile(await getProfile());
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const loadDrafts = useCallback(async () => {
    setDraftsLoading(true);
    try {
      setDrafts(await apiGetDrafts());
    } finally {
      setDraftsLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setHistory(await apiGetHistory());
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Profile is needed immediately (onboarding gate + author name), so fetch it
  // as soon as the provider mounts. Drafts/history load lazily on first read.
  useEffect(() => {
    if (!profileFetched.current) {
      profileFetched.current = true;
      void loadProfile();
    }
  }, [loadProfile]);

  const saveProfile = useCallback(async (updates: Partial<UserProfile>) => {
    const saved = await apiSaveProfile(updates);
    setProfile(saved);
    return saved;
  }, []);

  const refreshProfile = useCallback(() => loadProfile(), [loadProfile]);

  const ensureDrafts = useCallback(() => {
    if (!draftsFetched.current) {
      draftsFetched.current = true;
      void loadDrafts();
    }
  }, [loadDrafts]);

  const ensureHistory = useCallback(() => {
    if (!historyFetched.current) {
      historyFetched.current = true;
      void loadHistory();
    }
  }, [loadHistory]);

  const refreshDrafts = useCallback(() => {
    draftsFetched.current = true;
    return loadDrafts();
  }, [loadDrafts]);

  const refreshHistory = useCallback(() => {
    historyFetched.current = true;
    return loadHistory();
  }, [loadHistory]);

  const removeDraftFromCache = useCallback((id: string) => {
    setDrafts((prev) => (prev ? prev.filter((d) => d.id !== id) : prev));
  }, []);

  const value: AppDataValue = {
    profile,
    profileLoading,
    saveProfile,
    refreshProfile,
    drafts,
    draftsLoading,
    ensureDrafts,
    refreshDrafts,
    removeDraftFromCache,
    history,
    historyLoading,
    ensureHistory,
    refreshHistory,
  };

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return ctx;
}

/** Profile slice. Returns cache state; profile loads eagerly with the provider. */
export function useProfile() {
  const { profile, profileLoading, saveProfile, refreshProfile } = useAppData();
  return {
    profile,
    loading: profileLoading || profile === null,
    saveProfile,
    refreshProfile,
  };
}

/** Drafts slice. Lazily fetches on first use. */
export function useDrafts() {
  const ctx = useAppData();
  const { ensureDrafts } = ctx;
  useEffect(() => {
    ensureDrafts();
  }, [ensureDrafts]);
  return {
    drafts: ctx.drafts,
    loading: ctx.draftsLoading || ctx.drafts === null,
    refresh: ctx.refreshDrafts,
    removeFromCache: ctx.removeDraftFromCache,
  };
}

/** History slice. Lazily fetches on first use. */
export function useHistory() {
  const ctx = useAppData();
  const { ensureHistory } = ctx;
  useEffect(() => {
    ensureHistory();
  }, [ensureHistory]);
  return {
    history: ctx.history,
    loading: ctx.historyLoading || ctx.history === null,
    refresh: ctx.refreshHistory,
  };
}

export { EMPTY_PROFILE };
