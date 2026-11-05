import type {
  GroupedAssetSummary,
  InvestmentAssetSummary,
} from "@/lib/dashboard-types";
import { formatCurrencyAmount } from "@/lib/dashboard-utils";
import { getPositionValue } from "@/components/earn/earn-utils";
import type { YieldPosition } from "@/types/db";
import { cn } from "@/lib/utils";

interface PortfolioAllocationPanelProps {
  activeCurrency: string;
  groupedAssets: GroupedAssetSummary[];
  investmentAssets: InvestmentAssetSummary[];
  yieldPositions: YieldPosition[];
  exchangeRate: number;
  isBalanceVisible: boolean;
  onAddFunds?: () => void;
}

export default function PortfolioAllocationPanel({
  activeCurrency,
  groupedAssets,
  investmentAssets,
  yieldPositions,
  exchangeRate,
  isBalanceVisible,
  onAddFunds,
}: PortfolioAllocationPanelProps) {
  const stablecoinValue = groupedAssets.reduce(
    (total, asset) => total + asset.usdValue,
    0,
  );
  const stockValue = investmentAssets.reduce(
    (total, asset) => total + asset.usdValue,
    0,
  );
  const yieldValue = yieldPositions.reduce(
    (total, position) => total + getPositionValue(position),
    0,
  );
  const total = stablecoinValue + stockValue + yieldValue;
  const stablecoinPercentage = total > 0 ? (stablecoinValue / total) * 100 : 0;
  const stockPercentage = total > 0 ? (stockValue / total) * 100 : 0;
  const yieldPercentage = total > 0 ? (yieldValue / total) * 100 : 0;
  const totalInCurrency =
    activeCurrency === "USD"
      ? total
      : groupedAssets.reduce((sum, asset) => sum + asset.localValue, 0) +
        investmentAssets.reduce((sum, asset) => sum + asset.localValue, 0) +
        yieldValue * exchangeRate;

  const stockEnd = stablecoinPercentage + stockPercentage;

  const ringStyle =
    total > 0
      ? {
          background: `conic-gradient(#c558ac 0 ${stablecoinPercentage}%, #7d4de8 ${stablecoinPercentage}% ${stockEnd}%, #15a36f ${stockEnd}% 100%)`,
        }
      : undefined;

  return (
    <section className="hidden rounded-xl border border-black/10 bg-white/80 p-5 shadow-none dark:border-white/10 dark:bg-secondary-50 min-[1280px]:col-span-full min-[1280px]:flex min-[1280px]:min-h-[190px] min-[1280px]:border-0 min-[1280px]:!bg-white/80 min-[1280px]:p-4 min-[1280px]:shadow-none min-[1280px]:flex-col min-[1280px]:items-stretch min-[1280px]:dark:!bg-secondary-50">
      <h3 className="text-base font-semibold text-cryptoNight dark:text-white">
        Portfolio allocation
      </h3>
      <div className="flex flex-1 items-center gap-5 pt-1">
        <div
          className={cn(
            "relative grid h-28 w-28 shrink-0 place-items-center rounded-full transition-all",
            total > 0
              ? "shadow-sm shadow-primary-90/10"
              : "border border-black/10 bg-gray-100 dark:border-white/10 dark:bg-white/5",
          )}
          style={ringStyle}
        >
          <div className="grid h-[82px] w-[82px] place-items-center rounded-full bg-white text-center dark:bg-secondary-50">
            <div className="flex flex-col items-center justify-center px-1">
              <span className="text-xs font-semibold text-cryptoNight dark:text-white">
                {isBalanceVisible
                  ? formatCurrencyAmount(totalInCurrency, activeCurrency)
                  : "••••••"}
              </span>
              {total <= 0 ? (
                <span className="mt-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-500">
                  0%
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {total > 0 ? (
          <div className="min-w-0 flex-1 space-y-2 text-xs">
            <AllocationRow
              color="bg-primary-70"
              label="Stablecoins"
              percentage={stablecoinPercentage}
            />
            <AllocationRow
              color="bg-violet-500"
              label="Tokenized stocks"
              percentage={stockPercentage}
            />
            <AllocationRow
              color="bg-emerald-500"
              label="Yield positions"
              percentage={yieldPercentage}
            />
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 text-xs">
            <div>
              <p className="font-semibold text-cryptoNight dark:text-white">
                No assets allocated
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                Deposit or add funds to see your stablecoins, stocks, and yield
                breakdown.
              </p>
            </div>
            {onAddFunds ? (
              <button
                type="button"
                onClick={onAddFunds}
                className="inline-flex w-fit cursor-pointer items-center gap-1 rounded-lg bg-primary-50/10 px-2.5 py-1 text-[11px] font-semibold text-primary-60 transition hover:bg-primary-50/20 dark:bg-primary-70/15 dark:text-primary-80 dark:hover:bg-primary-70/25"
              >
                + Add funds
              </button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function AllocationRow({
  color,
  label,
  percentage,
}: {
  color: string;
  label: string;
  percentage: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2 text-gray-500 dark:text-gray-40">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
        <span className="truncate">{label}</span>
      </span>
      <span className="font-medium tabular-nums text-cryptoNight dark:text-white">
        {percentage.toFixed(1)}%
      </span>
    </div>
  );
}
