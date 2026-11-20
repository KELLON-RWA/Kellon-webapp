function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-100 dark:bg-white/10 ${className}`} />;
}

export default function MainRouteLoading() {
  return (
    <div
      className="w-full space-y-6 px-4 pb-32 pt-4 md:space-y-6 md:px-6 md:pb-12 md:pt-28 lg:space-y-4 lg:px-8 lg:pt-24 xl:px-10 2xl:px-12"
      aria-busy="true"
      aria-label="Loading wallet"
    >
      <Skeleton className="h-7 w-48" />

      <div className="grid grid-cols-1 gap-6 lg:gap-4 xl:grid-cols-12 xl:items-start 2xl:gap-6">
        <div className="contents xl:col-span-7 xl:flex xl:min-w-0 xl:flex-col xl:gap-4 xl:h-full 2xl:col-span-7 3xl:col-span-8">
          <section className="relative min-h-[178px] overflow-hidden rounded-xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-secondary-50/20 lg:p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-7 w-44 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <Skeleton className="mt-5 h-9 w-44" />
            <Skeleton className="mt-2 h-4 w-20" />
            <div className="absolute right-6 top-1/2 hidden w-auto max-w-[340px] -translate-y-1/2 grid-cols-2 gap-3 lg:grid">
              <Skeleton className="h-[58px] w-36" />
              <Skeleton className="h-[58px] w-36" />
            </div>
          </section>

          <section className="min-h-[420px] rounded-xl bg-white/80 p-4 dark:bg-secondary-50 lg:min-h-[520px]">
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
              <div className="grid grid-cols-[minmax(120px,1.7fr)_80px_90px] gap-3 border-b border-black/10 px-5 py-3 dark:border-white/10">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-12" />
              </div>
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[minmax(120px,1.7fr)_80px_90px] items-center gap-3 border-b border-black/10 px-5 py-4 last:border-b-0 dark:border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-2.5 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-14 justify-self-end" />
                  <Skeleton className="h-3 w-16 justify-self-end" />
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="contents lg:grid lg:grid-cols-2 lg:gap-4 xl:col-span-5 xl:flex xl:flex-col 2xl:col-span-5 3xl:col-span-4 2xl:grid 2xl:grid-cols-2 2xl:gap-4">
          <section className="grid grid-cols-2 gap-2 rounded-xl bg-white/80 p-2 dark:bg-secondary-50 2xl:col-span-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[72px]" />
            ))}
          </section>
          <section className="rounded-xl bg-white/80 p-4 dark:bg-secondary-50">
            <Skeleton className="h-5 w-36" />
            <div className="mt-4 flex items-center gap-5">
              <Skeleton className="h-28 w-28 rounded-full" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            </div>
          </section>
          <section className="rounded-xl bg-white/80 p-4 dark:bg-secondary-50">
            <Skeleton className="h-5 w-28" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
