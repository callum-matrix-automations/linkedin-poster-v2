"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getProfile, saveSearch, getSavedSearch, createDraft } from "@/lib/storage";
import { clearCurrentDraft } from "@/lib/draft-store";
import { PostCard } from "@/components/post-card";
import { SuggestionCard } from "@/components/suggestion-card";
import type { LinkedInPost, PostSuggestion } from "@/lib/types";

const TIME_OPTIONS = [
  { value: "1h", label: "Past hour" },
  { value: "24h", label: "Past 24 hours" },
  { value: "week", label: "Past week" },
  { value: "month", label: "Past month" },
  { value: "3months", label: "Past 3 months" },
  { value: "6months", label: "Past 6 months" },
  { value: "year", label: "Past year" },
] as const;

const SORT_OPTIONS = [
  { value: "relevance", label: "Most relevant" },
  { value: "date", label: "Most recent" },
] as const;

const DISPLAY_OPTIONS = [
  { value: "6", label: "6 posts" },
  { value: "12", label: "12 posts" },
  { value: "20", label: "20 posts" },
  { value: "50", label: "All results" },
] as const;

const SORT_RESULTS_OPTIONS = [
  { value: "engagement", label: "Most engagement" },
  { value: "likes", label: "Most likes" },
  { value: "comments", label: "Most comments" },
  { value: "shares", label: "Most shares" },
  { value: "recent", label: "Most recent" },
] as const;

function getTotal(post: LinkedInPost) {
  return (
    (post.engagement?.likes ?? 0) +
    (post.engagement?.comments ?? 0) +
    (post.engagement?.shares ?? 0)
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-chrome-text">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-chrome-border bg-chrome-light px-3 py-2 text-sm text-chrome-text-strong outline-none transition-colors focus:border-accent"
        style={{ transitionDuration: "var(--duration-fast)" }}>
        {options.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
      </select>
    </div>
  );
}

function FilterInput({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-chrome-text">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="rounded-lg border border-chrome-border bg-chrome-light px-3 py-2 text-sm text-chrome-text-strong outline-none transition-colors placeholder:text-chrome-text focus:border-accent"
        style={{ transitionDuration: "var(--duration-fast)" }} />
    </div>
  );
}

function TagInput({ label, values, onChange, placeholder }: {
  label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string;
}) {
  const [input, setInput] = useState("");
  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      if (!values.includes(input.trim())) onChange([...values, input.trim()]);
      setInput("");
    }
    if (e.key === "Backspace" && !input && values.length > 0) onChange(values.slice(0, -1));
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-chrome-text">{label}</label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-chrome-border bg-chrome-light px-3 py-2">
        {values.map((v, i) => (
          <span key={i} className="flex items-center gap-1 rounded-md bg-chrome-border px-2 py-0.5 text-xs font-medium text-chrome-text-strong">
            {v}
            <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))} className="ml-0.5 text-chrome-text hover:text-chrome-text-strong">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
            </button>
          </span>
        ))}
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
          placeholder={values.length === 0 ? placeholder : ""} className="min-w-30 flex-1 bg-transparent text-sm text-chrome-text-strong outline-none placeholder:text-chrome-text" />
      </div>
      <p className="text-[10px] text-chrome-text">Press Enter or comma to add</p>
    </div>
  );
}

export default function FindPage() {
  const router = useRouter();
  const [queries, setQueries] = useState<string[]>([""]);
  const [allPosts, setAllPosts] = useState<LinkedInPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [sortBy, setSortBy] = useState("relevance");
  const [postedLimit, setPostedLimit] = useState("month");
  const [authorCompanies, setAuthorCompanies] = useState<string[]>([]);
  const [authorProfiles, setAuthorProfiles] = useState<string[]>([]);

  const [displayCount, setDisplayCount] = useState("6");
  const [sortResults, setSortResults] = useState("engagement");
  const [minEngagement, setMinEngagement] = useState("");
  const [minLikes, setMinLikes] = useState("");
  const [minComments, setMinComments] = useState("");

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bypassFilters, setBypassFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());

  const [suggestions, setSuggestions] = useState<PostSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [creatingDraft, setCreatingDraft] = useState(false);

  useEffect(() => {
    const saved = getSavedSearch();
    if (saved) {
      setQueries(saved.queries.length ? saved.queries : [""]);
      setAllPosts(saved.posts);
      setHasSearched(true);
    }
  }, []);

  const filteredPosts = useMemo(() => {
    let result = [...allPosts];
    if (!bypassFilters) {
      const minEng = minEngagement ? Number(minEngagement) : 0;
      const minL = minLikes ? Number(minLikes) : 0;
      const minC = minComments ? Number(minComments) : 0;
      if (minEng > 0 || minL > 0 || minC > 0) {
        result = result.filter((p) => {
          const likes = p.engagement?.likes ?? 0;
          const comments = p.engagement?.comments ?? 0;
          return getTotal(p) >= minEng && likes >= minL && comments >= minC;
        });
      }
    }
    const sortKey = bypassFilters ? "engagement" : sortResults;
    result.sort((a, b) => {
      switch (sortKey) {
        case "likes": return (b.engagement?.likes ?? 0) - (a.engagement?.likes ?? 0);
        case "comments": return (b.engagement?.comments ?? 0) - (a.engagement?.comments ?? 0);
        case "shares": return (b.engagement?.shares ?? 0) - (a.engagement?.shares ?? 0);
        case "recent": return (b.postedAt?.timestamp ?? 0) - (a.postedAt?.timestamp ?? 0);
        default: return getTotal(b) - getTotal(a);
      }
    });
    return result;
  }, [allPosts, sortResults, minEngagement, minLikes, minComments, bypassFilters]);

  const visiblePosts = useMemo(() => filteredPosts.slice(0, visibleCount), [filteredPosts, visibleCount]);
  const hasMore = visibleCount < filteredPosts.length;

  const updateQuery = useCallback((i: number, v: string) => {
    setQueries((prev) => { const next = [...prev]; next[i] = v; return next; });
  }, []);
  const addQuery = useCallback(() => setQueries((p) => p.length < 5 ? [...p, ""] : p), []);
  const removeQuery = useCallback((i: number) => setQueries((p) => p.length > 1 ? p.filter((_, j) => j !== i) : p), []);
  const canSearch = queries.some((q) => q.trim().length > 0);

  const activeFilterCount = [
    postedLimit !== "month", sortBy !== "relevance", sortResults !== "engagement",
    displayCount !== "6", minEngagement !== "", minLikes !== "", minComments !== "",
    authorCompanies.length > 0, authorProfiles.length > 0,
  ].filter(Boolean).length;

  async function handleSearch() {
    if (!canSearch) return;
    setLoading(true); setError(null); setAllPosts([]); setHasSearched(true);
    setBypassFilters(false); setVisibleCount(Number(displayCount));
    setSelectedPostIds(new Set()); setSuggestions([]);
    try {
      const res = await fetch("/api/search-posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchQueries: queries.filter((q) => q.trim()), sortBy, postedLimit,
          authorsCompanyPublicIdentifiers: authorCompanies.length ? authorCompanies : undefined,
          authorsPublicIdentifiers: authorProfiles.length ? authorProfiles : undefined,
        }),
      });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || `Request failed (${res.status})`); }
      const data = await res.json();
      const posts = data.posts || [];
      setAllPosts(posts);
      saveSearch(queries.filter((q) => q.trim()), posts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(false); }
  }

  const togglePostSelection = useCallback((postId: string) => {
    setSelectedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }, []);

  const selectedPosts = useMemo(() => filteredPosts.filter((p) => selectedPostIds.has(p.id)), [filteredPosts, selectedPostIds]);

  async function handleGenerateSuggestions() {
    setSuggestionsLoading(true); setSuggestionsError(null); setSuggestions([]);
    try {
      const profile = await getProfile();
      const postsForAI = selectedPosts.length > 0 ? selectedPosts : filteredPosts.slice(0, 6);
      const res = await fetch("/api/ai/generate-suggestions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, posts: postsForAI, count: 6 }),
      });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || `Request failed (${res.status})`); }
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setSuggestionsError(err instanceof Error ? err.message : "Failed to generate suggestions");
    } finally { setSuggestionsLoading(false); }
  }

  async function handleSelectSuggestion(suggestion: PostSuggestion) {
    if (creatingDraft) return;
    setCreatingDraft(true);
    try {
      const postsForContext =
        selectedPosts.length > 0 ? selectedPosts : filteredPosts.slice(0, 6);
      const draft = await createDraft(suggestion, postsForContext);
      clearCurrentDraft();
      router.push(`/write?id=${draft.id}`);
    } catch {
      setCreatingDraft(false);
    }
  }

  return (
    <div className="bg-chrome px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="mb-2 text-2xl font-semibold tracking-tight text-chrome-text-strong">Find inspiring posts</h1>
          <p className="text-sm text-chrome-text">Search for topics you want to post about. We&apos;ll find the highest-performing LinkedIn posts to use as inspiration.</p>
        </header>

        <div className="mb-8">
          <div className="flex flex-col gap-3">
            {queries.map((query, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="text" value={query} onChange={(e) => updateQuery(i, e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && canSearch && !loading) { e.preventDefault(); handleSearch(); } }}
                  placeholder={i === 0 ? 'e.g. "B2B sales strategies"' : "Add another topic..."} maxLength={85}
                  className="flex-1 rounded-lg border border-chrome-border bg-chrome-light px-4 py-3 text-sm text-chrome-text-strong outline-none transition-colors placeholder:text-chrome-text focus:border-accent"
                  style={{ transitionDuration: "var(--duration-fast)" }} />
                {queries.length > 1 && (
                  <button type="button" onClick={() => removeQuery(i)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-chrome-text transition-colors hover:text-chrome-text-strong" style={{ transitionDuration: "var(--duration-fast)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            {queries.length < 5 && (
              <button type="button" onClick={addQuery} className="flex items-center gap-1.5 text-sm font-medium text-chrome-text transition-colors hover:text-chrome-text-strong" style={{ transitionDuration: "var(--duration-fast)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                Add query
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={() => setFiltersOpen(!filtersOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-chrome-border px-3 py-2 text-sm font-medium text-chrome-text transition-colors hover:border-chrome-text hover:text-chrome-text-strong"
              style={{ transitionDuration: "var(--duration-fast)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
              </svg>
              Filters
              {activeFilterCount > 0 && (<span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-text">{activeFilterCount}</span>)}
            </button>
            <button type="button" onClick={handleSearch} disabled={!canSearch || loading}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-text transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-30"
              style={{ transitionDuration: "var(--duration-fast)", transitionTimingFunction: "var(--ease-out-expo)" }}>
              {loading ? "Searching..." : "Find posts"}
            </button>
          </div>

          {filtersOpen && (
            <div className="mt-4 flex flex-col gap-5 rounded-lg border border-chrome-border bg-chrome-light p-5" style={{ animation: "fadeIn var(--duration-normal) var(--ease-out-expo)" }}>
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-chrome-text">Search</p>
                <div className="grid grid-cols-2 gap-4">
                  <FilterSelect label="Time range" value={postedLimit} onChange={setPostedLimit} options={TIME_OPTIONS} />
                  <FilterSelect label="LinkedIn sort" value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
                </div>
              </div>
              <div className="h-px bg-chrome-border" />
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-chrome-text">Results</p>
                <div className="grid grid-cols-2 gap-4">
                  <FilterSelect label="Sort results by" value={sortResults} onChange={setSortResults} options={SORT_RESULTS_OPTIONS} />
                  <FilterSelect label="Show" value={displayCount} onChange={setDisplayCount} options={DISPLAY_OPTIONS} />
                </div>
              </div>
              <div className="h-px bg-chrome-border" />
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-chrome-text">Engagement minimums</p>
                <div className="grid grid-cols-3 gap-4">
                  <FilterInput label="Min total engagement" value={minEngagement} onChange={setMinEngagement} placeholder="e.g. 100" type="number" />
                  <FilterInput label="Min likes" value={minLikes} onChange={setMinLikes} placeholder="e.g. 50" type="number" />
                  <FilterInput label="Min comments" value={minComments} onChange={setMinComments} placeholder="e.g. 10" type="number" />
                </div>
              </div>
              <div className="h-px bg-chrome-border" />
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-chrome-text">Author filters</p>
                <div className="grid grid-cols-2 gap-4">
                  <TagInput label="Author's company" values={authorCompanies} onChange={setAuthorCompanies} placeholder="e.g. google, microsoft" />
                  <TagInput label="Author profiles" values={authorProfiles} onChange={setAuthorProfiles} placeholder="e.g. williamhgates" />
                </div>
              </div>
            </div>
          )}
        </div>

        {loading && (
          <div className="py-20 text-center">
            <div className="mb-4 inline-block h-6 w-6 animate-spin rounded-full border-2 border-chrome-border border-t-accent" />
            <p className="text-sm text-chrome-text">Searching LinkedIn for posts. This usually takes a few seconds.</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
            {error}
            <button type="button" onClick={handleSearch} className="ml-2 font-medium underline underline-offset-2">Retry</button>
          </div>
        )}

        {!loading && hasSearched && visiblePosts.length === 0 && !error && (
          <div className="py-20 text-center">
            <p className="mb-1 text-sm font-medium text-chrome-text-strong">{allPosts.length === 0 ? "No posts found" : "No posts match your filters"}</p>
            <p className="mb-4 text-sm text-chrome-text">
              {allPosts.length === 0
                ? "Try broader keywords or a wider time range."
                : `${allPosts.length} post${allPosts.length !== 1 ? "s were" : " was"} found, but none match your engagement filters. Try lowering the thresholds.`}
            </p>
            {allPosts.length > 0 && (
              <button type="button" onClick={() => { setBypassFilters(true); setVisibleCount(Number(displayCount)); }}
                className="rounded-lg border border-chrome-border px-4 py-2 text-sm font-medium text-chrome-text transition-colors hover:border-chrome-text hover:text-chrome-text-strong"
                style={{ transitionDuration: "var(--duration-fast)" }}>See anyway</button>
            )}
          </div>
        )}

        {visiblePosts.length > 0 && (
          <div>
            <p className="mb-4 text-sm text-chrome-text">
              Showing {visiblePosts.length} of {filteredPosts.length} post{filteredPosts.length !== 1 ? "s" : ""}
              {filteredPosts.length < allPosts.length && ` (${allPosts.length} total)`}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {visiblePosts.map((post) => (
                <PostCard key={post.id} post={post} selected={selectedPostIds.has(post.id)} onToggleSelect={togglePostSelection} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-6 text-center">
                <button type="button" onClick={() => setVisibleCount((prev) => prev + Number(displayCount))}
                  className="rounded-lg border border-chrome-border px-5 py-2.5 text-sm font-medium text-chrome-text transition-colors hover:border-chrome-text hover:text-chrome-text-strong"
                  style={{ transitionDuration: "var(--duration-fast)" }}>
                  See more ({Math.min(Number(displayCount), filteredPosts.length - visibleCount)} more)
                </button>
              </div>
            )}

            {!suggestionsLoading && suggestions.length === 0 && (
              <div className="mt-8 border-t border-chrome-border pt-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="mb-1 text-lg font-semibold text-chrome-text-strong">Ready to write?</h2>
                    <p className="text-sm text-chrome-text">
                      {selectedPostIds.size > 0
                        ? `${selectedPostIds.size} post${selectedPostIds.size !== 1 ? "s" : ""} selected as inspiration.`
                        : "Select posts as inspiration, or we'll use the top results."}
                    </p>
                  </div>
                  <button type="button" onClick={handleGenerateSuggestions}
                    className="shrink-0 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-text transition-all hover:bg-accent-hover"
                    style={{ transitionDuration: "var(--duration-fast)", transitionTimingFunction: "var(--ease-out-expo)" }}>
                    Generate post ideas
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {suggestionsLoading && (
          <div className="mt-8 border-t border-chrome-border py-16 text-center">
            <div className="mb-4 inline-block h-6 w-6 animate-spin rounded-full border-2 border-chrome-border border-t-accent" />
            <p className="text-sm text-chrome-text">Analyzing posts and your profile to generate ideas...</p>
          </div>
        )}

        {suggestionsError && (
          <div className="mt-8 rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
            {suggestionsError}
            <button type="button" onClick={handleGenerateSuggestions} className="ml-2 font-medium underline underline-offset-2">Retry</button>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="mt-8 border-t border-chrome-border pt-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="mb-1 text-lg font-semibold text-chrome-text-strong">Post ideas for you</h2>
                <p className="text-sm text-chrome-text">Pick one to start writing.</p>
              </div>
              <button type="button" onClick={handleGenerateSuggestions} disabled={suggestionsLoading}
                className="shrink-0 rounded-lg border border-chrome-border px-4 py-2 text-sm font-medium text-chrome-text transition-colors hover:border-chrome-text hover:text-chrome-text-strong disabled:opacity-30"
                style={{ transitionDuration: "var(--duration-fast)" }}>Regenerate</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {suggestions.map((suggestion, i) => (
                <SuggestionCard key={`${suggestion.title}-${i}`} suggestion={suggestion} index={i} onSelect={handleSelectSuggestion} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
