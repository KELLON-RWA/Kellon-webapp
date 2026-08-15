import { Clock3, RefreshCw, RouteIcon } from "lucide-react";
import type { BridgeRateOption } from "@/services/api/bridge";
import { BRIDGE_CARD_CLASS } from "./constants";
import {
  formatBridgeBalance,
  formatBridgeDuration,
  getRouteAggregator,
  getRouteDuration,
  getRouteFee,
  getRouteId,
  getRouteProvider,
  getRouteReceiveAmount,
} from "./utils";

interface BridgeRoutesPanelProps {
  routes: BridgeRateOption[];
  symbol: string;
  selectedRouteId?: string;
  bestRouteId?: string;
  fastestRouteId?: string;
  isLoading: boolean;
  showAllRoutes: boolean;
  onShowAll: () => void;
  onSelect: (route: BridgeRateOption) => void;
}

export function BridgeRoutesPanel({
  routes,
  symbol,
  selectedRouteId,
  bestRouteId,
  fastestRouteId,
  isLoading,
  showAllRoutes,
  onShowAll,
  onSelect,
}: BridgeRoutesPanelProps) {
  if (isLoading) {
    return (
      <div className={BRIDGE_CARD_CLASS}>
        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <RefreshCw className="h-4 w-4 animate-spin text-primary-50" />
          Finding the best available routes…
        </div>
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className={BRIDGE_CARD_CLASS}>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-70/10 text-primary-60">
            <RouteIcon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-black dark:text-white">
              Bridge routes
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              No routes are currently available for this transfer.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className={BRIDGE_CARD_CLASS} aria-labelledby="bridge-routes-title">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2
            id="bridge-routes-title"
            className="text-sm font-bold text-black dark:text-white"
          >
            Bridge routes
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Best return is selected automatically.
          </p>
        </div>
        <RouteIcon className="h-4 w-4 text-primary-50" />
      </div>

      <div className="space-y-2.5">
        {routes.map((route, index) => {
          const routeId = getRouteId(route);
          const isSelected = selectedRouteId === routeId;
          const isBest = bestRouteId === routeId;
          const isFastest = fastestRouteId === routeId;
          const receive = getRouteReceiveAmount(route);
          const fee = getRouteFee(route);
          const duration = getRouteDuration(route);

          return (
            <button
              key={routeId}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(route)}
              className={`${index > 0 && !showAllRoutes ? "hidden lg:block" : "block"} w-full cursor-pointer rounded-2xl border p-4 text-left transition-all ${
                isSelected
                  ? "border-primary-60 bg-primary-70/5 ring-2 ring-primary-60/20"
                  : "border-black/5 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-50 dark:hover:bg-secondary-60/50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isBest ? (
                      <span className="rounded-full bg-primary-70/10 px-2 py-0.5 text-[10px] font-bold text-primary-60">
                        Best return
                      </span>
                    ) : null}
                    {isFastest ? (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        Fastest
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 truncate text-sm font-bold text-black dark:text-white">
                    {getRouteProvider(route)}
                  </p>
                  {route.messengerName ? (
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      via {getRouteAggregator(route)}
                    </p>
                  ) : null}
                  <p className="mt-1 text-lg font-semibold text-black dark:text-white">
                    ≈ {formatBridgeBalance(receive)} {symbol}
                  </p>
                </div>
                <span
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    isSelected
                      ? "border-primary-60 bg-primary-60"
                      : "border-black/10 dark:border-white/20"
                  }`}
                >
                  {isSelected ? (
                    <span className="h-2 w-2 rounded-full bg-white" />
                  ) : null}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/5 pt-3 text-xs text-gray-500 dark:border-white/10 dark:text-gray-400">
                <span>
                  Fee ≈ {formatBridgeBalance(fee)} {symbol}
                </span>
                {duration > 0 ? (
                  <span className="flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatBridgeDuration(duration)}
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
