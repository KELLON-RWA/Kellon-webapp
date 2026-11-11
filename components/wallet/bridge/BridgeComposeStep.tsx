"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, ArrowRight, ArrowUpDown, Loader2 } from "lucide-react";
import type { ConvertAssetOption, ConvertMode } from "@/lib/convert-assets";
import { cn } from "@/lib/utils";
import { formatMaxInputAmount } from "@/lib/token-amount";
import type { Route } from "@/services/api/swap";
import type { BridgeRateOption } from "@/services/api/bridge";
import { getRouteId } from "./utils";
import { BridgeRoutesPanel } from "./BridgeRoutesPanel";
import { SwapRoutesPanel } from "../swap/SwapRoutesPanel";
import { BridgeAssetSelector } from "./BridgeAssetSelector";
import { BridgeNetworkSelector } from "./BridgeNetworkSelector";

interface Props {
  sources: ConvertAssetOption[];
  destinations: ConvertAssetOption[];
  source: ConvertAssetOption | null;
  destination: ConvertAssetOption | null;
  amount: string;
  receiveAmount: number | string;
  isAmountValid: boolean;
  mode: ConvertMode;
  filterMode: "all" | "swap" | "bridge";
  onFilterModeChange: (filter: "all" | "swap" | "bridge") => void;
  onModeToggle: (targetMode: ConvertMode) => void;
  onSourceChange: (key: string) => void;
  onDestinationChange: (key: string, mode?: ConvertMode) => void;
  onAmountChange: (amount: string) => void;
  onFlip: () => void;
  canFlip: boolean;
  // Swap specific
  swapRoutes: Route[];
  selectedSwapRoute: Route | null;
  isLoadingSwapRoutes: boolean;
  swapError: string | null;
  onSelectSwapRoute: (route: Route) => void;
  // Bridge specific
  bridgeRoutes: BridgeRateOption[];
  selectedBridgeRoute: BridgeRateOption | null;
  bestRouteId?: string;
  fastestRouteId?: string;
  isLoadingBridgeRoutes: boolean;
  bridgeError: string | null;
  onSelectBridgeRoute: (route: BridgeRateOption) => void;
  // Shared
  showAllRoutes: boolean;
  onShowAllRoutes: () => void;
  isSubmitting: boolean;
  onReview: () => void;
}
function getAmountFontSize(value: string | number): string {
  const str = String(value ?? "");
  const len = str.length;
  if (len <= 7) return "text-3xl sm:text-4xl";
  if (len <= 10) return "text-2xl sm:text-3xl";
  if (len <= 13) return "text-xl sm:text-2xl";
  if (len <= 16) return "text-lg sm:text-xl";
  return "text-base sm:text-lg";
}

function formatUsdValue(val: string | number): string {
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(num);
}

export function BridgeComposeStep(props: Props) {
  const {
    source,
    destination,
    amount,
    receiveAmount,
    isAmountValid,
    mode,
    swapRoutes,
    selectedSwapRoute,
    isLoadingSwapRoutes,
    swapError,
    bridgeRoutes,
    selectedBridgeRoute,
    bestRouteId,
    fastestRouteId,
    isLoadingBridgeRoutes,
    bridgeError,
  } = props;

  // Available source networks for currently selected Send asset (USDC or USDT)
  const availableSourceNetworks = useMemo(() => {
    const currentSymbol = source?.symbol || "USDC";
    return props.sources
      .filter((s) => s.symbol === currentSymbol)
      .map((s) => ({
        chainKey: s.chainKey,
        chainName: s.chainName,
        balance: s.balance,
      }))
      .sort((a, b) => (b.balance || 0) - (a.balance || 0));
  }, [props.sources, source?.symbol]);

  // Available destination networks across all valid destination options for this source
  const availableDestNetworks = useMemo(() => {
    const map = new Map<string, { chainKey: string; chainName: string }>();
    props.destinations.forEach((d) => {
      if (!map.has(d.chainKey)) {
        map.set(d.chainKey, { chainKey: d.chainKey, chainName: d.chainName });
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      // Prioritize source chain first for instant same-chain swapping
      if (a.chainKey === source?.chainKey) return -1;
      if (b.chainKey === source?.chainKey) return 1;
      return a.chainName.localeCompare(b.chainName);
    });
  }, [props.destinations, source?.chainKey]);

  // Handle Send Symbol toggle (USDC <-> USDT)
  const handleSendSymbolChange = (newSymbol: "USDC" | "USDT") => {
    if (source?.symbol === newSymbol) return;
    const sameChain = props.sources.find(
      (s) => s.symbol === newSymbol && s.chainKey === source?.chainKey,
    );
    if (sameChain) {
      props.onSourceChange(sameChain.key);
      return;
    }
    const best = props.sources
      .filter((s) => s.symbol === newSymbol)
      .sort((a, b) => b.balance - a.balance)[0];
    if (best) {
      props.onSourceChange(best.key);
    }
  };

  // Handle Send Network dropdown selection
  const handleSourceChainChange = (chainKey: string) => {
    const currentSymbol = source?.symbol || "USDC";
    const target = props.sources.find(
      (s) => s.symbol === currentSymbol && s.chainKey === chainKey,
    );
    if (target) {
      props.onSourceChange(target.key);
    }
  };

  // Handle Receive Symbol toggle (USDC <-> USDT)
  const handleReceiveSymbolChange = (newSymbol: "USDC" | "USDT") => {
    if (destination?.symbol === newSymbol) return;
    const candidates = props.destinations.filter((d) => d.symbol === newSymbol);
    if (!candidates.length) return;

    // Prefer keeping the current destination chain if supported for the new asset
    const matchCurrentDestChain = candidates.find(
      (d) => d.chainKey === destination?.chainKey,
    );
    if (matchCurrentDestChain) {
      props.onDestinationChange(
        matchCurrentDestChain.key,
        matchCurrentDestChain.mode,
      );
      return;
    }

    // Otherwise prefer source chain (same-chain swap)
    const matchSourceChain = candidates.find(
      (d) => d.chainKey === source?.chainKey,
    );
    if (matchSourceChain) {
      props.onDestinationChange(
        matchSourceChain.key,
        matchSourceChain.mode,
      );
      return;
    }

    // Fallback to first available candidate
    props.onDestinationChange(candidates[0].key, candidates[0].mode);
  };

  // Handle Receive Network dropdown selection
  const handleDestChainChange = (chainKey: string) => {
    const currentSymbol = destination?.symbol || "USDC";
    // 1. Try to match the current symbol on the chosen chain
    const targetSameSymbol = props.destinations.find(
      (d) => d.chainKey === chainKey && d.symbol === currentSymbol,
    );
    if (targetSameSymbol) {
      props.onDestinationChange(targetSameSymbol.key, targetSameSymbol.mode);
      return;
    }
    // 2. Otherwise pick any valid asset on this chain (e.g. USDT on Base when source is Base USDC)
    const targetAny = props.destinations.find((d) => d.chainKey === chainKey);
    if (targetAny) {
      props.onDestinationChange(targetAny.key, targetAny.mode);
    }
  };

  const formattedReceive =
    typeof receiveAmount === "number"
      ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(
          receiveAmount,
        )
      : receiveAmount;

  const isLoadingRoutes =
    mode === "swap" ? isLoadingSwapRoutes : isLoadingBridgeRoutes;
  const routeError = mode === "swap" ? swapError : bridgeError;
  const hasSelectedRoute =
    mode === "swap" ? Boolean(selectedSwapRoute) : Boolean(selectedBridgeRoute);

  const amountNumber = Number(amount);
  const isOverBalance =
    source && Number.isFinite(amountNumber) && amountNumber > source.balance;

  const convertCardRef = useRef<HTMLElement>(null);
  const [cardHeight, setCardHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!convertCardRef.current) return;
    const updateHeight = () => {
      if (convertCardRef.current) {
        setCardHeight(convertCardRef.current.offsetHeight);
      }
    };
    updateHeight();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(updateHeight);
      ro.observe(convertCardRef.current);
      return () => ro.disconnect();
    }
  }, []);

  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col items-center justify-center gap-6 transition-all duration-300",
        isAmountValid
          ? "max-w-7xl lg:flex-row lg:items-start lg:justify-center lg:gap-5 xl:gap-8"
          : "max-w-[480px]",
      )}
    >
      {/* Main Convert Card (maintains exact initial size, never stretched by routes) */}
      <section
        ref={convertCardRef}
        className="relative flex w-full min-w-0 flex-1 max-w-[480px] flex-col overflow-hidden rounded-[28px] border border-black/5 bg-white p-4 shadow-none min-[360px]:p-5 dark:border-white/10 dark:bg-secondary-50"
      >
        {/* Subtle decorative gradient glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_20%_0%,rgba(138,22,133,0.12),transparent_50%)] dark:bg-[radial-gradient(circle_at_20%_0%,rgba(193,92,165,0.22),transparent_50%)]" />

        <div className="relative flex flex-col space-y-4">
          <div className="space-y-4">
            {/* Header Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 rounded-xl bg-gray-95 px-3 py-1.5 dark:bg-white/5">
                <ArrowLeftRight className="h-3.5 w-3.5 text-primary-60" />
                <span className="text-xs font-bold text-black dark:text-white">
                  {mode === "swap" ? "Swap" : "Bridge"}
                </span>
              </div>

              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {source?.chainName && destination?.chainName
                  ? `${source.chainName} → ${destination.chainName}`
                  : "Universal Route"}
              </p>
            </div>

            <div className="space-y-0">
              {/* Send Container */}
              <div className="rounded-2xl border border-black/5 bg-gray-95/60 p-4 transition-all focus-within:border-black/15 dark:border-white/5 dark:bg-white/[0.04] dark:focus-within:border-white/20">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-semibold uppercase tracking-wider">
                    Send
                  </span>
                </div>

                {/* Amount input + Token & Network selectors on a single line */}
                <div className="mt-3 flex min-w-0 flex-col items-stretch gap-3 min-[380px]:flex-row min-[380px]:items-center">
                  <div className="min-w-0 flex-1">
                    <input
                      id="convert-send-amount"
                      aria-label="Send amount"
                      value={amount}
                      onChange={(e) =>
                        props.onAmountChange(
                          e.target.value.replace(/[^0-9.]/g, ""),
                        )
                      }
                      inputMode="decimal"
                      placeholder="0.00"
                      className={cn(
                        "w-full bg-transparent font-bold text-black outline-none placeholder:text-gray-400 transition-all duration-150 dark:text-white dark:placeholder:text-gray-600",
                        getAmountFontSize(amount),
                      )}
                    />
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatUsdValue(amount)}
                    </p>
                  </div>

                  {/* Option C: Token selector + Network selector side-by-side */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <BridgeAssetSelector
                      value={source?.symbol || "USDC"}
                      onChange={handleSendSymbolChange}
                    />
                    <BridgeNetworkSelector
                      value={source?.chainKey || ""}
                      options={availableSourceNetworks}
                      onChange={handleSourceChainChange}
                      showBalance
                    />
                  </div>
                </div>

                {/* Available balance and Max button */}
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/5 pt-2.5 text-xs text-gray-500 dark:border-white/5 dark:text-gray-400">
                  <span>
                    {new Intl.NumberFormat("en-US", {
                      maximumFractionDigits: 6,
                    }).format(source?.balance || 0)}{" "}
                    {source?.symbol} available
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      source &&
                      props.onAmountChange(
                        formatMaxInputAmount(
                          source.balance,
                          Math.min(source.decimals, 6),
                        ),
                      )
                    }
                    className="cursor-pointer font-bold uppercase text-primary-60 hover:text-primary-70"
                  >
                    Max
                  </button>
                </div>
              </div>

              {/* Flip / Reverse Direction Button */}
              <div className="relative z-10 -my-3 flex items-center justify-center">
                <button
                  type="button"
                  onClick={props.onFlip}
                  disabled={!props.canFlip}
                  aria-label="Swap direction"
                  className={cn(
                    "flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-primary-60/30 bg-white text-primary-60 shadow-sm transition hover:scale-110 active:scale-95 dark:border-primary-60/40 dark:bg-secondary-60 dark:text-primary-50",
                    !props.canFlip && "opacity-40 cursor-not-allowed",
                  )}
                >
                  <ArrowUpDown className="h-4 w-4" />
                </button>
              </div>

              {/* Receive Container */}
              <div className="rounded-2xl border border-black/5 bg-gray-95/60 p-4 transition-all dark:border-white/5 dark:bg-white/[0.04]">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-semibold uppercase tracking-wider">
                    Receive
                  </span>
                </div>

                {/* Amount display + Token & Network selectors on a single line */}
                <div className="mt-3 flex min-w-0 flex-col items-stretch gap-3 min-[380px]:flex-row min-[380px]:items-center">
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "font-bold text-black transition-all duration-150 whitespace-nowrap dark:text-white",
                        getAmountFontSize(receiveAmount),
                      )}
                    >
                      {Number(receiveAmount) > 0 ? formattedReceive : "0.00"}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatUsdValue(receiveAmount)}
                    </p>
                  </div>

                  {/* Option C: Token selector + Network selector side-by-side */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <BridgeAssetSelector
                      value={destination?.symbol || "USDC"}
                      onChange={handleReceiveSymbolChange}
                    />
                    <BridgeNetworkSelector
                      value={destination?.chainKey || ""}
                      options={availableDestNetworks}
                      onChange={handleDestChainChange}
                    />
                  </div>
                </div>

                {/* Estimated receive text */}
                <div className="mt-3 border-t border-black/5 pt-2.5 text-xs text-gray-500 dark:border-white/5 dark:text-gray-400">
                  <span>
                    {hasSelectedRoute
                      ? `Estimated ${destination?.symbol || ""} after ${mode}`
                      : "Your estimated receive amount will appear here"}
                  </span>
                </div>
              </div>
            </div>

            {/* Balance validation error */}
            {isOverBalance && source ? (
              <p className="text-xs font-medium text-red-500">
                Amount exceeds your{" "}
                {new Intl.NumberFormat("en-US", {
                  maximumFractionDigits: 6,
                }).format(source.balance)}{" "}
                {source.symbol} balance.
              </p>
            ) : null}

            {/* Routing error */}
            {routeError ? (
              <p className="rounded-xl border border-red-500/15 bg-red-500/5 px-3 py-2 text-xs text-red-500">
                {routeError}
              </p>
            ) : null}
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={props.onReview}
              disabled={
                !isAmountValid || !hasSelectedRoute || props.isSubmitting
              }
              className={cn(
                "flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-60 to-primary-70 px-6 font-bold text-white shadow-md transition-all active:scale-[0.99] cursor-pointer",
                (!isAmountValid || !hasSelectedRoute || props.isSubmitting) &&
                  "opacity-50 cursor-not-allowed shadow-none",
              )}
            >
              <span>
                {!amount || Number(amount) <= 0
                  ? "Enter an amount"
                  : isOverBalance
                    ? "Insufficient balance"
                    : isLoadingRoutes
                      ? "Finding routes…"
                      : mode === "swap"
                        ? "Review swap"
                        : "Review bridge"}
              </span>
              {isLoadingRoutes || props.isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Routes Panel (desktop side or mobile below, exact same size as initial swap card, scrollable routes) */}
      {isAmountValid ? (
        <div
          style={cardHeight ? { height: `${cardHeight}px` } : undefined}
          className="w-full min-w-0 flex-1 max-w-[480px] min-h-[440px] flex flex-col"
        >
          {mode === "swap" ? (
            <SwapRoutesPanel
              className="relative flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-black/5 bg-white p-4 shadow-none min-[360px]:p-5 dark:border-white/10 dark:bg-secondary-50"
              routes={swapRoutes}
              symbol={destination?.symbol || ""}
              fromSymbol={source?.symbol || "USDC"}
              fromAmount={amount}
              destChainKey={destination?.chainKey}
              selectedRouteId={selectedSwapRoute?.id}
              isLoading={isLoadingSwapRoutes}
              onSelect={props.onSelectSwapRoute}
            />
          ) : (
            <BridgeRoutesPanel
              className="relative flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-black/5 bg-white p-4 shadow-none min-[360px]:p-5 dark:border-white/10 dark:bg-secondary-50"
              routes={bridgeRoutes}
              symbol={destination?.symbol || ""}
              fromSymbol={source?.symbol || "USDC"}
              fromAmount={amount}
              destChainKey={destination?.chainKey}
              selectedRouteId={getRouteId(selectedBridgeRoute)}
              bestRouteId={bestRouteId}
              fastestRouteId={fastestRouteId}
              isLoading={isLoadingBridgeRoutes}
              onSelect={props.onSelectBridgeRoute}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

export { BridgeComposeStep as ConvertComposeStep };
