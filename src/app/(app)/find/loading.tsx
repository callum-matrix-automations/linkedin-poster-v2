import { Skeleton, SkeletonLine } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="bg-chrome px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <Skeleton className="mb-3 h-7 w-56" />
          <SkeletonLine w="w-96" />
        </header>
        <div className="mb-8 flex flex-col gap-3">
          <Skeleton className="h-12 w-full" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-28" />
            <div className="flex-1" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>
      </div>
    </div>
  );
}
