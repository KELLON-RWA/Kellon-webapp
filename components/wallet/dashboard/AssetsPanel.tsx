import { Coins } from "lucide-react";
import AssetCard from "@/components/wallet/dashboard/AssetCard";
import FlowEmptyState from "@/components/wallet/shared/FlowEmptyState";
import { MAINNET_CHAINS } from "@/lib/chains";
import type { GroupedAssetSummary } from "@/lib/dashboard-types";
import { formatAssetAmount, formatCurrencyAmount } from "@/lib/dashboard-utils";

const NATIVE_ASSET_SYMBOLS = new Set(
  Object.values(MAINNET_CHAINS).map((chain) =>
    chain.nativeCurrency.symbol.toUpperCase(),
  ),
);

interface AssetsPanelProps {
  activeCurrency: string;
  displayCurrency: "LOCAL" | "USD";
  groupedAssets: GroupedAssetSummary[];
  isAssetValueLoading: boolean;
  isBalanceVisible: boolean;
}

export default function AssetsPanel({
  activeCurrency,
  displayCurrency,
  groupedAssets,
  isAssetValueLoading,
  isBalanceVisible,
}: AssetsPanelProps) {
  const visibleAssets = groupedAssets.filter(
    (asset) => !NATIVE_ASSET_SYMBOLS.has(asset.symbol.trim().toUpperCase()),
  );

  return (
    <div className="order-3 flex w-full flex-col gap-4 min-[900px]:col-span-full lg:!h-[270px] lg:overflow-hidden lg:rounded-xl lg:border lg:border-white/70 lg:bg-white/60 lg:p-5 lg:shadow-sm lg:shadow-primary-90/20 lg:backdrop-blur-xl lg:dark:border-white/10 lg:dark:bg-transparent lg:dark:shadow-none">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-semibold leading-tight tracking-normal text-black dark:text-white md:text-base">
            My Assets
          </h3>
        </div>
      </div>

      {visibleAssets.length > 0 ? (
        <div className="grid min-h-0 content-start gap-3 lg:max-h-full lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
          {visibleAssets.map((asset) => {
            const cardValue =
              displayCurrency === "LOCAL" ? asset.localValue : asset.usdValue;

            return (
              <AssetCard
                key={asset.symbol}
                name={asset.name}
                symbol={asset.symbol}
                amount={formatAssetAmount(asset.amount)}
                value={formatCurrencyAmount(cardValue, activeCurrency)}
                hideBalances={!isBalanceVisible}
                isValueLoading={isAssetValueLoading}
                className="px-3 py-3 xs:px-4 md:px-4 md:py-3 lg:px-5 lg:py-4"
              />
            );
          })}
        </div>
      ) : (
        <FlowEmptyState
          className="min-h-[220px] flex-1 rounded-xl border-black/10 bg-white/70 shadow-sm shadow-primary-90/10 dark:border-white/10 dark:bg-secondary-50 dark:shadow-none md:min-h-0 md:rounded-lg lg:items-start lg:text-left"
          icon={
            <Coins
              size={24}
              className="text-primary-50 dark:text-gray-600 md:h-7 md:w-7"
            />
          }
          title="No assets yet"
          text="Your holdings will appear here after your first deposit or crypto purchase."
          textClassName="max-w-[220px]"
        />
      )}
    </div>
  );
}
