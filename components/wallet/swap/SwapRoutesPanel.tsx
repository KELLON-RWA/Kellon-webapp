import { Clock3, RefreshCw, RouteIcon } from "lucide-react";
import type { Route } from "@/services/api/swap";
import { SWAP_CARD_CLASS } from "./constants";
import {
  formatDuration,
  formatSwapAmount,
  getRouteDuration,
  getRouteFeeUsd,
  getRouteProvider,
  getRouteReceiveAmount,
} from "./utils";

interface SwapRoutesPanelProps {
  routes: Route[];
  symbol: string;
  selectedRouteId?: string;
  isLoading: boolean;
  showAllRoutes: boolean;
  onShowAll: () => void;
  onSelect: (route: Route) => void;
}

export function SwapRoutesPanel({
  routes,
  symbol,
  selectedRouteId,
  isLoading,
  showAllRoutes,
  onShowAll,
  onSelect,
}: SwapRoutesPanelProps) {
  if (isLoading)
    return (
      <div className={SWAP_CARD_CLASS}>
        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <RefreshCw className="h-4 w-4 animate-spin text-primary-50" />
          Finding the best swap routes…
        </div>
      </div>
    );
  if (!routes.length)
    return (
      <div className={SWAP_CARD_CLASS}>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-70/10 text-primary-60">
            <RouteIcon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-black dark:text-white">
              Swap routes
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Enter an amount to compare available routes.
            </p>
          </div>
        </div>
      </div>
    );

  return (
    <section className={SWAP_CARD_CLASS} aria-labelledby="swap-routes-title">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2
            id="swap-routes-title"
            className="text-sm font-bold text-black dark:text-white"
          >
            Swap routes
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Best return is selected automatically.
          </p>
        </div>
        <RouteIcon className="h-4 w-4 text-primary-50" />
      </div>
      <div className="space-y-2.5">
        {routes.map((route, index) => {
          const selected = route.id === selectedRouteId;
          const duration = getRouteDuration(route);
          return (
            <button
              key={route.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(route)}
              className={`${index > 0 && !showAllRoutes ? "hidden lg:block" : "block"} w-full cursor-pointer rounded-2xl border p-4 text-left transition-all ${selected ? "border-primary-60 bg-primary-70/5 ring-2 ring-primary-60/20" : "border-black/5 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-50 dark:hover:bg-secondary-60/50"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary-70/10 px-2 py-0.5 text-[10px] font-bold text-primary-60">
                      {index === 0 ? "Best return" : "Alternative"}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-sm font-bold text-black dark:text-white">
                    {getRouteProvider(route)}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-black dark:text-white">
                    ≈ {formatSwapAmount(getRouteReceiveAmount(route))} {symbol}
                  </p>
                </div>
                <span
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-primary-60 bg-primary-60" : "border-black/10 dark:border-white/20"}`}
                >
                  {selected ? (
                    <span className="h-2 w-2 rounded-full bg-white" />
                  ) : null}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/5 pt-3 text-xs text-gray-500 dark:border-white/10 dark:text-gray-400">
                <span>
                  Network cost ≈ ${formatSwapAmount(getRouteFeeUsd(route), 2)}
                </span>
                {duration > 0 ? (
                  <span className="flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatDuration(duration)}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
      {routes.length > 1 && !showAllRoutes ? (
        <button
          type="button"
          onClick={onShowAll}
          className="mt-3 w-full cursor-pointer rounded-xl border border-black/5 bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-50 dark:text-white dark:hover:bg-secondary-60/50 lg:hidden"
        >
          See all routes ({routes.length})
        </button>
      ) : null}
    </section>
  );
}
