import { cn } from "@/lib/utils";
import Image from "next/image";
import { CheckCircle2, ChevronDown, Globe, ArrowRight } from "lucide-react";
import ChainIcon from "@/components/wallet/ChainIcon";
import { getSupportedChainsForToken } from "@/lib/chains";
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter";

interface AssetSelectionStepProps {
  asset: string | null;
  networkName: string | null;
  networkId: string | null;
  country: string | null;
  isDetectingCountry: boolean;
  onSelectAsset: (asset: string) => void;
  onSelectNetwork: (name: string, id: string) => void;
  onOpenCountryModal: () => void;
  onContinue: () => void;
}

const assets = [
  { id: "usdc", name: "USD Coin", symbol: "USDC" },
  { id: "usdt", name: "Tether", symbol: "USDT" },
];

export const getFlag = (code: string) =>
  code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397));

export function AssetSelectionStep({
  asset,
  networkName,
  country,
  isDetectingCountry,
  onSelectAsset,
  onSelectNetwork,
  onOpenCountryModal,
  onContinue,
}: AssetSelectionStepProps) {
  const availableNetworks = asset
    ? getSupportedChainsForToken(asset as "USDC" | "USDT")
    : [];

  const hasValidSelection = asset && networkName;

  return (
    <div className="flex flex-col h-full min-h-[calc(100dvh-200px)] md:min-h-[500px]">
      <div className="flex-1 overflow-y-auto  md:px-0">
        {/* Country Selector */}
        <div className="flex justify-center  mb-8">
          <button
            type="button"
            onClick={onOpenCountryModal}
            disabled={isDetectingCountry}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-1.5 transition-all hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-50 dark:hover:bg-secondary-60/50",
              isDetectingCountry && "animate-pulse opacity-70",
            )}
          >
            <span className="text-lg leading-none">
              {country ? getFlag(country) : <Globe className="h-4 w-4" />}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-tight">
              {isDetectingCountry ? "Locating..." : country || "NG"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          </button>
        </div>

        {/* Select Asset Section */}
        <section className="mb-8">
          <h3 className="mb-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Select Asset
          </h3>
          <div className="space-y-3">
            {assets.map((a) => (
              <button
                key={a.id}
                type="button"
                aria-pressed={asset === a.symbol}
                onClick={() => onSelectAsset(a.symbol)}
                className={cn(
                  "cursor-pointer",
                  "w-full rounded-2xl border p-4 text-left transition-all",
                  asset === a.symbol
                    ? "border-primary-60 bg-primary-70/5 ring-2 ring-primary-60/20"
                    : "border-black/5 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-50 dark:hover:bg-secondary-60/50",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative h-8 w-8">
                      <Image
                        src={`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${a.symbol.toLowerCase()}.png`}
                        alt={a.symbol}
                        fill
                        className="object-contain"
                      />
                    </div>
                    <div className="text-left">
                      <p
                        className={cn(
                          "text-sm font-bold",
                          asset === a.symbol
                            ? "text-primary-60"
                            : "text-black dark:text-white",
                        )}
                      >
                        {a.symbol}
                      </p>
                      <p className="text-xs text-gray-500">{a.name}</p>
                    </div>
                  </div>
                  {asset === a.symbol && (
                    <CheckCircle2 className="h-5 w-5 text-primary-70" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Select Network Section */}
        {asset && (
          <section className="animate-in fade-in slide-in-from-bottom-2">
            <h3 className="mb-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Select Network
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {availableNetworks.map((chain) => {
                const chainNameLower = chain.name.toLowerCase();
                const isSelected = networkName === chainNameLower;
                return (
                  <button
                    key={chain.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() =>
                      onSelectNetwork(chainNameLower, chain.id.toString())
                    }
                    className={cn(
                      "cursor-pointer",
                      "flex items-center gap-3 rounded-xl border p-4 text-sm font-bold transition-all",
                      isSelected
                        ? "border-primary-60 bg-primary-70/5 ring-2 ring-primary-60/20"
                        : "border-black/5 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-50 dark:hover:bg-secondary-60/50",
                    )}
                  >
                    <ChainIcon name={chain.name} size={20} />
                    {chain.name}
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <FlowActionFooter
        className="bg-gradient-to-t"
        onClick={onContinue}
        disabled={!hasValidSelection}
        buttonClassName={cn(!hasValidSelection && "from-gray-400 to-gray-500")}
        showShimmer={Boolean(hasValidSelection)}
        helperText="Select the asset and network you want to purchase"
      >
        {!hasValidSelection ? (
          "Select Asset & Network to Continue"
        ) : (
          <>
            Continue
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </FlowActionFooter>
    </div>
  );
}
