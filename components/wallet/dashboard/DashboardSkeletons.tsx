import { cn } from "@/lib/utils";

export function ActivityListSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-hidden pr-1">
      <div className="overflow-hidden rounded-xl border border-black/5 bg-white dark:border-white/10 dark:bg-secondary-50">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex animate-pulse items-center justify-between gap-3 border-b border-black/5 px-3 py-3 last:border-b-0 dark:border-white/10 min-[1024px]:gap-2 min-[1024px]:px-2.5 min-[1024px]:py-2.5 lg:gap-3 lg:px-3 lg:py-3"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3 min-[1024px]:gap-2 lg:gap-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-gray-100 dark:bg-secondary-60 min-[1024px]:h-7 min-[1024px]:w-7 lg:h-8 lg:w-8" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-24 rounded-full bg-gray-100 dark:bg-secondary-60 min-[1024px]:w-20 lg:w-24" />
                <div className="flex items-center gap-2 min-[1024px]:gap-1.5">
                  <div className="h-2.5 w-10 rounded-full bg-gray-100 dark:bg-secondary-60" />
                  <div className="h-1 w-1 rounded-full bg-gray-200 dark:bg-secondary-60" />
                  <div className="h-2.5 w-12 rounded-full bg-gray-100 dark:bg-secondary-60" />
                </div>
              </div>
            </div>
            <div className="h-3 w-16 shrink-0 rounded-full bg-gray-100 dark:bg-secondary-60 min-[1024px]:w-12 lg:w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonLine({ className }: { className: string }) {
  return (
    <span
      className={cn(
        "block animate-pulse rounded-full bg-gray-100 dark:bg-secondary-60",
        className,
      )}
    />
  );
}
