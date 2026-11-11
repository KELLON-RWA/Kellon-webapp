import { Fragment } from "react";
import { cn } from "@/lib/utils";

export default function SendFlowSkeleton() {
  return (
    <div className="container mx-auto flex min-h-[100dvh] max-w-2xl flex-col pb-[env(safe-area-inset-bottom)] md:min-h-[90dvh] md:pb-32 md:pt-20">
      {/* Header skeleton */}
      <div className="mb-8 flex items-center justify-between px-4 pt-4">
        <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-secondary-60/50 animate-pulse" />
        <div className="h-6 w-24 rounded-lg bg-slate-200 dark:bg-secondary-60/50 animate-pulse" />
        <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-secondary-60/50 animate-pulse" />
      </div>

      {/* Step Indicator skeleton */}
      <div className="mx-auto mb-10 flex w-full max-w-sm items-center justify-between px-12">
        {Array.from({ length: 4 }).map((_, i) => (
          <Fragment key={i}>
            <div className="relative flex items-center justify-center">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border-2",
                  i === 0
                    ? "border-primary-60 bg-primary-60/40"
                    : "border-slate-300 dark:border-secondary-60"
                )}
              >
                <div
                  className={cn(
                    "rounded-full",
                    i === 0
                      ? "h-2 w-2 bg-white"
                      : "h-1.5 w-1.5 bg-slate-300 dark:bg-secondary-60"
                  )}
                />
              </div>
            </div>
            {i < 3 && (
              <div className="h-[2px] flex-1 bg-slate-200 dark:bg-secondary-60/30" />
            )}
          </Fragment>
        ))}
      </div>

      {/* Main Form + Recents Card Skeleton */}
      <div className="mx-auto flex w-11/12 min-w-0 flex-1 flex-col gap-5 pt-4 md:w-lg">
        <section className="h-full min-w-0 md:rounded-[24px] md:border md:border-black/5 md:bg-white/80 md:p-6 md:shadow-sm md:dark:border-white/10 md:dark:bg-secondary-50/80">
          <div className="flex flex-col gap-4">
            {/* Search/Recipient input skeleton */}
            <div className="h-14 w-full rounded-2xl border border-black/10 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-secondary-60/30 animate-pulse" />
          </div>
        </section>

        {/* Recents list skeleton */}
        <div className="flex min-w-0 flex-col gap-5">
          <div className="rounded-2xl border border-black/5 bg-white/60 p-4 dark:border-white/10 dark:bg-secondary-50/60">
            <div className="mb-3 h-4 w-20 rounded bg-slate-200 dark:bg-secondary-60/50 animate-pulse" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200 dark:bg-secondary-60/50 animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-32 rounded bg-slate-200 dark:bg-secondary-60/50 animate-pulse" />
                    <div className="h-3 w-48 rounded bg-slate-100 dark:bg-secondary-60/30 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action button skeleton */}
          <div className="h-12 w-full rounded-2xl bg-primary-60/30 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
