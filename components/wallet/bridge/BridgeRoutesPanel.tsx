"use client";

import { Check, Clock3, Fuel, RefreshCw, Route as RouteIcon } from "lucide-react";
import type { BridgeRateOption } from "@/services/api/bridge";
import { BRIDGE_CARD_CLASS } from "./constants";
import {
  formatBridgeBalance,
  getRouteAggregator,
  getRouteDuration,
  getRouteFee,
  getRouteId,
  getRouteProvider,
  getRouteReceiveAmount,
} from "./utils";
import { getTokenIcon } from "../swap/utils";
import { AssetLogo } from "@/components/invoices/create-invoice/AssetLogo";
import ChainIcon from "@/components/wallet/ChainIcon";
import type { SupportedChainKeys } from "@/lib/chains";
import { cn } from "@/lib/utils";

interface BridgeRoutesPanelProps {
  className?: string;
  routes: BridgeRateOption[];
  symbol: string;
  fromSymbol?: string;
  fromAmount?: string | number;
  destChainKey?: string;
  selectedRouteId?: string;
  bestRouteId?: string;
  fastestRouteId?: string;
  isLoading: boolean;
  showAllRoutes?: boolean;
  onShowAll?: () => void;
  onSelect: (route: BridgeRateOption) => void;
}

export function BridgeRoutesPanel({
  className,
  routes,
  symbol,
  fromSymbol = "USDC",
  fromAmount,
  destChainKey,
  selectedRouteId,
  bestRouteId,
  fastestRouteId,
  isLoading,
  onSelect,
}: BridgeRoutesPanelProps) {
  if (isLoading) {
    return (
      <div className={cn(BRIDGE_CARD_CLASS, className)}>
        <div className="mb-3 flex items-center justify-between shrink-0">
          <h2 className="text-base font-bold text-black dark:text-white">
            Receive
          </h2>
          <RefreshCw className="h-4 w-4 animate-spin text-primary-50" />
        </div>
        <div className="flex-1 min-h-0 space-y-2.5 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-full rounded-2xl border border-black/5 bg-gray-50/60 p-4 dark:border-white/5 dark:bg-white/[0.02] animate-pulse space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-black/5 dark:bg-white/10" />
                  <div className="space-y-1.5">
                    <div className="h-4 w-24 rounded bg-black/5 dark:bg-white/10" />
                    <div className="h-3 w-16 rounded bg-black/5 dark:bg-white/10" />
                  </div>
                </div>
                <div className="h-4 w-4 rounded bg-black/5 dark:bg-white/10" />
              </div>
              <div className="flex justify-between pt-2 border-t border-black/5 dark:border-white/5">
                <div className="h-3 w-28 rounded bg-black/5 dark:bg-white/10" />
                <div className="h-3 w-16 rounded bg-black/5 dark:bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className={cn(BRIDGE_CARD_CLASS, className)}>
        <div className="mb-3 flex items-center justify-between shrink-0">
          <h2 className="text-base font-bold text-black dark:text-white">
            Receive
          </h2>
          <RouteIcon className="h-4 w-4 text-primary-50" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-70/10 text-primary-60">
            <RouteIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-black dark:text-white">
              No routes available
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-xs">
              Reasons could be low liquidity, amount too low/high, or network congestion.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const sendAmountNum = Number(fromAmount);

  return (
    <section
      className={cn(BRIDGE_CARD_CLASS, className)}
      aria-labelledby="bridge-routes-title"
    >
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <h2
            id="bridge-routes-title"
            className="text-base font-bold text-black dark:text-white"
          >
            Receive
          </h2>
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-semibold text-gray-500 dark:bg-white/10 dark:text-gray-400">
            {routes.length} options
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1.5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/20 dark:[&::-webkit-scrollbar-thumb]:bg-white/25">
        {routes.map((route, index) => {
          const routeId = getRouteId(route);
          const isSelected = selectedRouteId
            ? selectedRouteId === routeId
            : bestRouteId
              ? bestRouteId === routeId
              : index === 0;
          const isBest = bestRouteId ? bestRouteId === routeId : index === 0;
          const isFastest = fastestRouteId === routeId && !isBest;
          const receive = getRouteReceiveAmount(route);
          const fee = getRouteFee(route);
          const duration = getRouteDuration(route);
          const providerName = getRouteProvider(route);
          const aggregator = getRouteAggregator(route);

          const rateText =
            Number.isFinite(sendAmountNum) && sendAmountNum > 0
              ? `1 ${fromSymbol} ≈ ${(receive / sendAmountNum).toFixed(6)} ${symbol}`
              : `1 ${fromSymbol} ≈ 1 ${symbol}`;

          const feeDisplay = fee <= 0 ? "Free" : `$${formatBridgeBalance(fee)}`;
          const durationDisplay =
            duration < 60
              ? `${Math.ceil(duration)}s`
              : `~${Math.ceil(duration / 60)}m`;

          return (
            <button
              key={routeId}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(route)}
              className={cn(
                "group relative w-full cursor-pointer rounded-2xl border p-3.5 text-left transition-all",
                isSelected
                  ? "border-primary-60 bg-primary-60/[0.08] shadow-sm ring-2 ring-primary-60/40 dark:border-primary-50 dark:bg-primary-50/[0.12] dark:ring-primary-50/50"
                  : "border-black/5 bg-white hover:border-black/15 hover:bg-gray-50/90 dark:border-white/10 dark:bg-secondary-50 dark:hover:border-white/20 dark:hover:bg-secondary-60/50",
              )}
            >
              {/* Badges (Best Return / Fastest / Selected) */}
              {isBest || isFastest || isSelected ? (
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {isBest ? (
                      <span className="inline-flex items-center rounded-md bg-primary-60/15 px-2 py-0.5 text-[10px] font-bold text-primary-60 dark:bg-primary-50/20 dark:text-primary-40">
                        Best Return
                      </span>
                    ) : null}
                    {isFastest ? (
                      <span className="inline-flex items-center rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        Fastest
                      </span>
                    ) : null}
                  </div>
                  {isSelected ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-60 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs dark:bg-primary-50 dark:text-black">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                      <span>Selected</span>
                    </span>
                  ) : null}
                </div>
              ) : null}

              {/* Main Row: Token with chain badge on left, Amount & provider in middle, Radio on right */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Token Logo with Destination Chain Badge overlay */}
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                    <AssetLogo
                      src={getTokenIcon(symbol)}
                      symbol={symbol}
                      size="md"
                    />
                    {destChainKey ? (
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-xs ring-1 ring-black/10 dark:bg-secondary-50 dark:ring-white/10">
                        <ChainIcon
                          name={destChainKey as SupportedChainKeys}
                          size={10}
                          className="!h-2.5 !w-2.5"
                        />
                      </span>
                    ) : null}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-xl font-bold text-black dark:text-white">
                      {formatBridgeBalance(receive)}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <span>${formatBridgeBalance(receive)}</span>
                      <span>•</span>
                      <span className="truncate font-medium">{providerName}</span>
                      {aggregator && aggregator !== providerName ? (
                        <span className="text-[10px] text-gray-400">({aggregator})</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Radio / Check Selection Indicator */}
                <div className="shrink-0 pl-2">
                  {isSelected ? (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-60 text-white shadow-xs transition-transform duration-150 scale-105 dark:bg-primary-50 dark:text-black">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-black/15 transition-colors group-hover:border-black/30 dark:border-white/20 dark:group-hover:border-white/40" />
                  )}
                </div>
              </div>

              {/* Bottom Meta Row (Exchange Rate on left, Fee & Duration on right) */}
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/5 pt-2.5 text-xs text-gray-500 dark:border-white/5 dark:text-gray-400">
                <span className="truncate">
                  {rateText}
                </span>
                <div className="flex shrink-0 items-center gap-2.5 font-medium">
                  <span className="flex items-center gap-1">
                    <Fuel className="h-3 w-3 text-gray-400" />
                    {feeDisplay}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock3 className="h-3 w-3 text-gray-400" />
                    {durationDisplay}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
