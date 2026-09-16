import { useState } from "react";
import { ArrowDown, ArrowRight, ChevronDown } from "lucide-react";
import ChainIcon from "@/components/wallet/ChainIcon";
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter";
import type { SwapAssetOption } from "@/lib/swap-assets";
import type { Route } from "@/services/api/swap";
import { SWAP_CARD_CLASS, SWAP_FORM_CARD_CLASS } from "../constants";
import { SwapRoutesPanel } from "../SwapRoutesPanel";
import { SwapTokenSelector } from "../SwapTokenSelector";
import { formatSwapAmount, getTokenIcon } from "../utils";

interface Props {
  sources: SwapAssetOption[];
  destinations: SwapAssetOption[];
  source: SwapAssetOption | null;
  destination: SwapAssetOption | null;
  amount: string;
  receiveAmount: number;
  isAmountValid: boolean;
  isLoadingTokens: boolean;
  routes: Route[];
  selectedRoute: Route | null;
  isLoadingRoutes: boolean;
  showAllRoutes: boolean;
  routeError: string | null;
  onSourceChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onRouteSelect: (route: Route) => void;
  onShowAllRoutes: () => void;
  onReview: () => void;
}

function TokenPill({ token }: { token: SwapAssetOption }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className="h-7 w-7 shrink-0 rounded-full bg-gray-90 bg-cover bg-center dark:bg-secondary-60"
        style={{
          backgroundImage: `url("${token.symbol.toUpperCase() === "USDT" ? getTokenIcon(token.symbol) : token.logoURI || getTokenIcon(token.symbol)}")`,
        }}
      />
      <span className="min-w-0 text-left">
        <span className="block truncate text-sm font-bold text-black dark:text-white">
          {token.symbol}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <ChainIcon name={token.chainKey} size={12} className="!h-3 !w-3" />
          {token.chainName}
        </span>
      </span>
    </span>
  );
}

export function SwapComposeStep(props: Props) {
  const [selector, setSelector] = useState<"source" | "destination" | null>(
    null,
  );
  if (!props.sources.length) {
    return (
      <div className={SWAP_CARD_CLASS}>
        <div className="rounded-2xl border border-dashed border-black/10 p-8 text-left dark:border-white/10">
          <p className="font-semibold text-black dark:text-white">
            {props.isLoadingTokens
              ? "Checking native balances"
              : "No native tokens to recover"}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {props.isLoadingTokens
              ? "Checking supported Kellon networks."
              : "Native tokens sent to your supported EVM wallets will appear here."}
          </p>
        </div>
      </div>
    );
  }

  const {
    source,
    destination,
    amount,
    receiveAmount,
    isAmountValid,
    routes,
    selectedRoute,
    isLoadingRoutes,
    showAllRoutes,
    routeError,
  } = props;
  return (
    <>
      <div
        className={
          isAmountValid
            ? "mx-auto grid w-full min-w-0 max-w-xl grid-cols-1 gap-4 lg:max-w-4xl lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)] lg:items-start lg:gap-6"
            : "mx-auto flex w-full max-w-xl min-w-0 flex-col gap-4"
        }
      >
        <section className={SWAP_FORM_CARD_CLASS}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_18%_0%,rgba(138,22,133,0.16),transparent_42%),linear-gradient(115deg,rgba(255,255,255,0.72),rgba(246,232,242,0.5)_44%,rgba(255,255,255,0.24))] dark:hidden lg:h-52" />
          <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-44 dark:block dark:bg-[radial-gradient(circle_at_20%_0%,rgba(193,92,165,0.45),transparent_48%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.14),transparent_38%)] lg:h-52" />
          <div className="relative space-y-5 lg:flex lg:h-full lg:flex-col lg:justify-center">
            <div className="space-y-0">
            <div className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm min-[320px]:p-4 dark:border-white/10 dark:bg-secondary-50">
              <p className="text-sm font-bold text-black dark:text-white">Send</p>
              <div className="mt-3 flex min-w-0 flex-col items-stretch gap-3 min-[320px]:flex-row min-[320px]:items-center">
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) =>
                    props.onAmountChange(
                      event.target.value.replace(/[^0-9.]/g, ""),
                    )
                  }
                  placeholder="0.00"
                  aria-label="Swap amount"
                  className="min-w-0 flex-1 bg-transparent text-2xl font-semibold text-black outline-none placeholder:text-gray-400 dark:text-white dark:placeholder:text-gray-600 sm:text-3xl"
                />
                {source ? (
                  <button
                    type="button"
                    onClick={() => setSelector("source")}
                    className="flex shrink-0 items-center gap-2 rounded-2xl bg-gray-95 px-3 py-2 transition hover:bg-gray-90 dark:bg-secondary-60 dark:hover:bg-secondary-60/70"
                  >
                    <TokenPill token={source} />
                    <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                  </button>
                ) : null}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span>
                  {source ? formatSwapAmount(source.balance) : "0"} {source?.symbol || ""} available
                </span>
                {source ? (
                  <button
                    type="button"
                    onClick={() => props.onAmountChange(String(source.balance))}
                    className="cursor-pointer font-bold uppercase text-primary-60"
                  >
                    Max
                  </button>
                ) : null}
              </div>
            </div>
            <div className="relative z-10 -my-3 flex items-center justify-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-primary-60/30 bg-primary-70/10 text-primary-60 shadow-sm dark:border-primary-60/40 dark:bg-secondary-60">
                <ArrowDown className="h-4 w-4" />
              </span>
            </div>
            <div className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm min-[320px]:p-4 dark:border-white/10 dark:bg-secondary-50">
              <p className="text-sm font-bold text-black dark:text-white">Receive</p>
              <div className="mt-3 flex min-w-0 flex-col items-stretch gap-3 min-[320px]:flex-row min-[320px]:items-center">
                <p className="min-w-0 flex-1 truncate text-2xl font-semibold text-black dark:text-white sm:text-3xl">
                  {receiveAmount > 0 ? formatSwapAmount(receiveAmount) : "0.00"}
                </p>
                {destination ? (
                  <button
                    type="button"
                    onClick={() => setSelector("destination")}
                    className="flex shrink-0 items-center gap-2 rounded-2xl bg-gray-95 px-3 py-2 transition hover:bg-gray-90 dark:bg-secondary-60 dark:hover:bg-secondary-60/70"
                  >
                    <TokenPill token={destination} />
                    <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                  </button>
                ) : null}
              </div>
            </div>
            </div>
            {amount && !isAmountValid && source ? (
              <p className="text-xs font-medium text-red-500">
                Enter an amount greater than 0 and no more than your{" "}
                {formatSwapAmount(source.balance)} {source.symbol} balance.
              </p>
            ) : null}
            {routeError ? (
              <p className="rounded-xl border border-red-500/15 bg-red-500/5 px-3 py-2 text-xs text-red-500">
                {routeError}
              </p>
            ) : null}
            <FlowActionFooter
              sticky={false}
              className="mt-2"
              onClick={props.onReview}
              disabled={!isAmountValid || !selectedRoute}
            >
              <span>{isLoadingRoutes ? "Finding routes…" : "Review swap"}</span>
              <ArrowRight className="h-4 w-4" />
            </FlowActionFooter>
          </div>
        </section>
        {isAmountValid ? (
          <SwapRoutesPanel
            routes={routes}
            symbol={destination?.symbol || ""}
            selectedRouteId={selectedRoute?.id}
            isLoading={isLoadingRoutes}
            showAllRoutes={showAllRoutes}
            onShowAll={props.onShowAllRoutes}
            onSelect={props.onRouteSelect}
          />
        ) : null}
      </div>
      <SwapTokenSelector
        open={selector === "source"}
        title="Select native token"
        description="Native balances across all Kellon networks"
        tokens={props.sources}
        selectedKey={source?.key}
        showBalance
        onOpenChange={(open) => setSelector(open ? "source" : null)}
        onSelect={props.onSourceChange}
      />
      <SwapTokenSelector
        open={selector === "destination"}
        title="Select token to receive"
        description="Choose USDC or USDT on the same network"
        tokens={props.destinations}
        selectedKey={destination?.key}
        onOpenChange={(open) => setSelector(open ? "destination" : null)}
        onSelect={props.onDestinationChange}
      />
    </>
  );
}
