"use client";

/**
 * Ghost/placeholder primitives shown while data loads. A single pulsing
 * surface block (`Skeleton`) plus a few composed shapes for the app's
 * recurring layouts (profile form, draft list, post editor).
 */

export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`animate-pulse rounded-md bg-chrome-light ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

/** A single greyed text line. `w` is a Tailwind width class. */
export function SkeletonLine({ w = "w-full", className = "" }: { w?: string; className?: string }) {
  return <Skeleton className={`h-3.5 ${w} ${className}`} />;
}

// --- Profile form ghost ---

export function ProfileSkeleton() {
  return (
    <div className="min-h-dvh bg-chrome px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-10">
          <Skeleton className="mb-3 h-7 w-44" />
          <SkeletonLine w="w-72" />
        </header>
        <div className="flex flex-col gap-7">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="mb-2 h-4 w-32" />
              <Skeleton className="mb-2.5 h-3 w-48" />
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Draft list ghost ---

export function DraftListSkeleton() {
  return (
    <div className="min-h-dvh bg-chrome px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10">
          <Skeleton className="mb-3 h-7 w-40" />
          <SkeletonLine w="w-80" />
        </header>
        <Skeleton className="mb-4 h-3 w-24" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-chrome-border bg-chrome-light px-4 py-3"
            >
              <Skeleton className="mb-2 h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Settings (BYOK provider cards) ghost ---

export function SettingsSkeleton() {
  return (
    <div className="min-h-dvh bg-chrome px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-10">
          <Skeleton className="mb-3 h-7 w-32" />
          <SkeletonLine w="w-80" />
        </header>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-chrome-border bg-chrome-light p-5"
            >
              <div className="flex items-start gap-3.5">
                <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="mb-2 h-4 w-28" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
              <div className="mt-4 flex flex-col gap-3">
                <Skeleton className="h-11 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-12 w-28" />
                  <Skeleton className="h-12 w-28" />
                  <Skeleton className="h-12 w-28" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Post editor ghost (split view: left lines, right LinkedIn preview) ---

export function PostEditorSkeleton() {
  return (
    <div className="flex h-full flex-col bg-chrome">
      <header className="flex shrink-0 items-center justify-between border-b border-chrome-border px-5 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-16" />
          <div className="h-4 w-px bg-chrome-border" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-7 w-32" />
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-col" style={{ width: "55%" }}>
          <div className="flex shrink-0 items-center gap-3 border-b border-chrome-border px-4 py-2.5">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex flex-col gap-3 p-6">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-4/5" />
            <div className="h-3" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
        </div>
        <div className="w-px bg-chrome-border" />
        <div className="flex min-h-0 flex-col bg-[#f4f2ee]" style={{ width: "45%" }}>
          <div className="mx-auto w-full max-w-lg px-6 py-6">
            <div className="rounded-xl border border-black/5 bg-white p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="h-12 w-12 animate-pulse rounded-full bg-black/10" />
                <div className="flex-1">
                  <div className="mb-1.5 h-3.5 w-32 animate-pulse rounded bg-black/10" />
                  <div className="h-3 w-24 animate-pulse rounded bg-black/5" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="h-3 w-full animate-pulse rounded bg-black/10" />
                <div className="h-3 w-11/12 animate-pulse rounded bg-black/10" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-black/10" />
                <div className="h-3 w-full animate-pulse rounded bg-black/10" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-black/10" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
