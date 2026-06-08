import { Skeleton, SkeletonLine } from "@/components/skeleton";

export default function Loading() {
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
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
