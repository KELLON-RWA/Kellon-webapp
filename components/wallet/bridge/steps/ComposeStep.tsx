import { ArrowRight, ArrowUpDown } from "lucide-react";
import { AssetLogo } from "@/components/invoices/create-invoice/AssetLogo";
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter";
import type { BridgeAssetOption } from "@/lib/bridge-assets";
import type { BridgeRateOption } from "@/services/api/bridge";
import { BridgeRoutesPanel } from "../BridgeRoutesPanel";
import { BRIDGE_CARD_CLASS, BRIDGE_FORM_CARD_CLASS } from "../constants";
import { NetworkSelector } from "../NetworkSelector";
import {
  formatBridgeBalance,
  getBridgeTokenIcon,
  getRouteId,
} from "../utils";

interface BridgeComposeStepProps {
  sources: BridgeAssetOption[];
  availableDestinations: BridgeAssetOption[];
  source: BridgeAssetOption | null;
  destination: BridgeAssetOption | null;
  sourceKey: string;
  destinationKey: string;
  amount: string;
  receiveAmount: string;
  minimumAmount: number;
  isAmountValid: boolean;
  canSwapNetworks: boolean;
  routes: BridgeRateOption[];
  selectedRoute: BridgeRateOption | null;
  bestRouteId?: string;
  fastestRouteId?: string;
  isLoadingRoutes: boolean;
  showAllRoutes: boolean;
  routeUnavailableMessage: string | null;
  isSubmitting: boolean;
  onTokenSelect: (symbol: BridgeAssetOption["symbol"]) => void;
  onSourceChange: (key: string) => void;
  onDestinationChange: (key: string) => void;
  onAmountChange: (amount: string) => void;
  onSwapNetworks: () => void;
  onRouteSelect: (route: BridgeRateOption) => void;
  onShowAllRoutes: () => void;
  onReview: () => void;
}

export function BridgeComposeStep({
  sources,
  availableDestinations,
  source,
  destination,
  sourceKey,
  destinationKey,
  amount,
  receiveAmount,
  minimumAmount,
  isAmountValid,
  canSwapNetworks,
  routes,
  selectedRoute,
  bestRouteId,
  fastestRouteId,
  isLoadingRoutes,
  showAllRoutes,
  routeUnavailableMessage,
  isSubmitting,
  onTokenSelect,
  onSourceChange,
  onDestinationChange,
  onAmountChange,
  onSwapNetworks,
  onRouteSelect,
  onShowAllRoutes,
  onReview,
}: BridgeComposeStepProps) {
  if (sources.length === 0) {
    return (
      <div className={BRIDGE_CARD_CLASS}>
        <div className="rounded-2xl border border-dashed border-black/10 p-8 text-center dark:border-white/10">
          <p className="font-semibold text-black dark:text-white">
            No bridgeable balance
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Add USDC or USDT to start bridging.
          </p>
        </div>
      </div>
    );
  }

  const selectedSymbol = source?.symbol || null;
  const tokenOptions = Array.from(
    new Map(sources.map((item) => [item.symbol, item])).values(),
  );

  return (
    <div
      className={
        isAmountValid
          ? "mx-auto grid w-full min-w-0 max-w-xl grid-cols-1 gap-4 lg:max-w-4xl lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)] lg:items-start lg:gap-6"
          : "mx-auto flex w-full max-w-xl min-w-0 flex-col gap-4"
      }
    >
      <section className={BRIDGE_FORM_CARD_CLASS}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_18%_0%,rgba(138,22,133,0.16),transparent_42%),linear-gradient(115deg,rgba(255,255,255,0.72),rgba(246,232,242,0.5)_44%,rgba(255,255,255,0.24))] dark:hidden lg:h-52" />
        <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-44 dark:block dark:bg-[radial-gradient(circle_at_20%_0%,rgba(193,92,165,0.45),transparent_48%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.14),transparent_38%)] lg:h-52" />
        <div className="relative space-y-5 lg:flex lg:h-full lg:flex-col lg:justify-center">
          <div>
            <h2 className="mb-3 text-sm font-bold text-black dark:text-white">
              Token
            </h2>
            <div className="grid grid-cols-1 gap-2 min-[320px]:grid-cols-2">
              {tokenOptions.map((token) => (
                <button
                  key={token.symbol}
                  type="button"
                  onClick={() => onTokenSelect(token.symbol)}
                  className={`flex min-w-0 cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition-all ${
                    selectedSymbol === token.symbol
                      ? "border-primary-60 bg-primary-70/5 ring-2 ring-primary-60/20"
                      : "border-black/5 bg-gray-95 text-gray-600 hover:text-black dark:border-white/10 dark:bg-secondary-50 dark:text-gray-400 dark:hover:bg-secondary-60/50 dark:hover:text-white"
                  }`}
                >
                  <AssetLogo
                    src={getBridgeTokenIcon(token.symbol)}
                    symbol={token.symbol}
                    size="sm"
                  />
                  <span
                    className={`truncate text-sm font-bold ${
                      selectedSymbol === token.symbol ? "text-primary-60" : ""
                    }`}
                  >
                    {token.symbol}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-black/5 pt-4 dark:border-white/5">
            <div className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm min-[320px]:p-4 dark:border-white/10 dark:bg-secondary-50">
              <p className="text-sm font-bold text-black dark:text-white">
                Send
              </p>
              <div className="mt-3 flex min-w-0 flex-col items-stretch gap-3 min-[320px]:flex-row min-[320px]:items-center">
                <input
                  id="bridge-amount"
                  aria-label="Amount to bridge"
                  value={amount}
                  onChange={(event) =>
                    onAmountChange(event.target.value.replace(/[^0-9.]/g, ""))
                  }
                  inputMode="decimal"
                  placeholder="0.00"
                  className="min-w-0 flex-1 bg-transparent text-2xl font-semibold text-black outline-none placeholder:text-gray-400 dark:text-white sm:text-3xl"
                />
                <NetworkSelector
                  value={sourceKey}
                  options={sources.filter(
                    (item) => item.symbol === selectedSymbol,
                  )}
                  onChange={onSourceChange}
                  showBalance
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span>
                  {source ? formatBridgeBalance(source.balance) : "0"}{" "}
                  {source?.symbol || ""} available
                </span>
                <button
                  type="button"
                  onClick={() => source && onAmountChange(String(source.balance))}
                  className="cursor-pointer font-bold uppercase text-primary-60"
                >
                  Max
                </button>
              </div>
            </div>

            <div className="relative z-10 -my-3 flex items-center justify-center">
              <button
                type="button"
                aria-label="Swap source and destination networks"
                aria-disabled={!canSwapNetworks}
                onClick={onSwapNetworks}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-primary-60/30 bg-primary-70/10 text-primary-60 shadow-sm transition hover:border-primary-60/50 hover:bg-primary-70/15 dark:border-primary-60/40 dark:bg-secondary-60 dark:hover:bg-secondary-50"
              >
                <ArrowUpDown className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm min-[320px]:p-4 dark:border-white/10 dark:bg-secondary-50">
              <p className="text-sm font-bold text-black dark:text-white">
                Receive
              </p>
              <div className="mt-3 flex min-w-0 flex-col items-stretch gap-3 min-[320px]:flex-row min-[320px]:items-center">
                <p className="min-w-0 flex-1 truncate text-2xl font-semibold text-black dark:text-white sm:text-3xl">
                  {receiveAmount
                    ? formatBridgeBalance(Number(receiveAmount))
                    : "0.00"}
                </p>
                <NetworkSelector
                  value={destinationKey}
                  options={availableDestinations}
                  onChange={onDestinationChange}
                />
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                {selectedRoute
                  ? `Estimated ${destination?.symbol || selectedSymbol || ""} after routing`
                  : "Your estimated receive amount will appear here"}
              </p>
            </div>

            {amount && !isAmountValid ? (
              <p className="mt-2 text-xs text-red-500">
                Enter at least {formatBridgeBalance(minimumAmount)}{" "}
                {source?.symbol || ""}, within your available balance.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <aside className="min-w-0 space-y-4 lg:sticky lg:top-24">
        {isAmountValid ? (
          <BridgeRoutesPanel
            routes={routes}
            symbol={source?.symbol || ""}
            selectedRouteId={getRouteId(selectedRoute)}
            bestRouteId={bestRouteId}
            fastestRouteId={fastestRouteId}
            isLoading={isLoadingRoutes}
            showAllRoutes={showAllRoutes}
            onShowAll={onShowAllRoutes}
            onSelect={onRouteSelect}
          />
        ) : null}

        <FlowActionFooter
          sticky={false}
          className="mt-0"
          onClick={onReview}
          disabled={!selectedRoute || isSubmitting || !isAmountValid}
          helperText="Review the route and final amount before confirming."
        >
          Review bridge
          <ArrowRight className="h-4 w-4" />
        </FlowActionFooter>
      </aside>

      {routeUnavailableMessage ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-400/10 dark:text-amber-200 md:col-span-2">
          {routeUnavailableMessage}
        </p>
      ) : null}
    </div>
  );
}
