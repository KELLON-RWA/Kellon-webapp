import type {
  GroupedAssetSummary,
  InvestmentAssetSummary,
} from "@/lib/dashboard-types";
import { formatCurrencyAmount } from "@/lib/dashboard-utils";
import { getPositionValue } from "@/components/earn/earn-utils";
import type { YieldPosition } from "@/types/db";

interface PortfolioAllocationPanelProps {
  activeCurrency: string;
  groupedAssets: GroupedAssetSummary[];
  investmentAssets: InvestmentAssetSummary[];
  yieldPositions: YieldPosition[];
  exchangeRate: number;
  isBalanceVisible: boolean;
}

export default function PortfolioAllocationPanel({
  activeCurrency,
  groupedAssets,
  investmentAssets,
  yieldPositions,
  exchangeRate,
  isBalanceVisible,
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
      <h3 className="text-base font-semibold text-cryptoNight dark:text-white">Portfolio allocation</h3>
      <div className="flex flex-1 items-center gap-5">
        <div
          className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full"
          style={ringStyle}
        >
          <div className="grid h-[82px] w-[82px] place-items-center rounded-full bg-white text-center dark:bg-secondary-50">
            <span className="px-2 text-xs font-semibold text-cryptoNight dark:text-white">
              {isBalanceVisible
                ? formatCurrencyAmount(totalInCurrency, activeCurrency)
                : "••••••"}
            </span>
          </div>
        </div>
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
