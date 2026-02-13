import { Skeleton } from "@onescope/ui";

export default function Loading() {
  return (
    <div className="flex h-screen w-full">
      <div className="hidden h-full w-64 flex-col gap-4 border-r border-gray-200 p-4 md:flex">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={`nav-skeleton-${idx}`} className="h-8 w-full rounded-md" />
          ))}
        </div>
        <div className="mt-auto space-y-2">
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-8 w-full rounded-md" />
        </div>
      </div>

      <div className="flex-1 space-y-6 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={`card-skeleton-${idx}`} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
