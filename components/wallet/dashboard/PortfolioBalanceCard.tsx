import { Eye, EyeOff } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { DisplayCurrency } from "@/lib/dashboard-types";
import { SkeletonLine } from "./DashboardSkeletons";

interface PortfolioBalanceCardProps {
  activeBalanceLabel: string;
  assetCountLabel: string;
  canToggleCurrency: boolean;
  countryCode: string;
  flag: string;
  hiddenActiveBalanceLabel: string;
  hiddenSecondaryBalanceLabel: string;
  isBalanceVisible: boolean;
  isDetecting: boolean;
  isLocalDisplay: boolean;
  isPortfolioLoading: boolean;
  localCurrency: string;
  portfolioLabel: string;
  secondaryBalanceLabel: string;
  setDisplayCurrency: Dispatch<SetStateAction<DisplayCurrency>>;
  setIsBalanceVisible: Dispatch<SetStateAction<boolean>>;
  totalNetworks: number;
}

export default function PortfolioBalanceCard({
  activeBalanceLabel,
  assetCountLabel,
  canToggleCurrency,
  countryCode,
  flag,
  hiddenActiveBalanceLabel,
  hiddenSecondaryBalanceLabel,
  isBalanceVisible,
  isDetecting,
  isLocalDisplay,
  isPortfolioLoading,
  localCurrency,
  portfolioLabel,
  secondaryBalanceLabel,
  setDisplayCurrency,
  setIsBalanceVisible,
  totalNetworks,
}: PortfolioBalanceCardProps) {
  return (
    <section className="order-1 flex flex-col items-start space-y-4 md:mb-0 md:block min-[1024px]:col-span-full">
      <div className="relative flex w-full flex-col items-start space-y-4 overflow-hidden rounded-2xl border border-white/70 bg-white/70 p-4 text-left text-gray-20 shadow-sm shadow-primary-90/30 backdrop-blur-xl dark:border-white/10 dark:bg-secondary-50/20 dark:text-gray-40 dark:shadow-none md:min-h-[320px] md:items-stretch md:justify-between md:rounded-xl md:border md:border-white/80 md:bg-white/75 md:p-6 md:text-left md:text-cryptoNight md:shadow-md md:shadow-primary-90/25 md:dark:border-white/10 md:dark:bg-secondary-50/20 md:dark:text-white md:dark:shadow-none min-[1024px]:!min-h-[178px] min-[1024px]:space-y-2 min-[1024px]:p-4 lg:!min-h-[178px] lg:p-4">
        <div className="absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_18%_0%,rgba(138,22,133,0.28),transparent_46%),radial-gradient(circle_at_72%_18%,rgba(209,71,163,0.16),transparent_44%),linear-gradient(115deg,rgba(255,255,255,0.76),rgba(246,232,242,0.72)_44%,rgba(255,255,255,0.32))] dark:hidden md:h-52 min-[1024px]:h-28" />
        <div className="absolute inset-x-0 top-0 hidden h-44 dark:block dark:bg-[radial-gradient(circle_at_20%_0%,rgba(193,92,165,0.45),transparent_48%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.14),transparent_38%)] md:h-52 min-[1024px]:h-28" />

        <div className="relative flex items-center justify-start gap-3 self-stretch md:justify-between">
          <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-[10px] font-bold tracking-tight text-gray-20 shadow-sm shadow-primary-90/20 dark:border-white/10 dark:bg-white/10 dark:text-white/75 dark:shadow-none md:py-1.5 md:backdrop-blur">
            <span
              className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-black/10 bg-primary-99 text-[11px] leading-none dark:border-white/10 dark:bg-transparent md:border-black/10 md:bg-primary-99 md:dark:border-white/20 md:dark:bg-white/5"
              aria-label={`Detected country ${countryCode}`}
              title={countryCode}
            >
              {isDetecting ? <SkeletonLine className="h-2.5 w-2.5" /> : flag}
            </span>
            {isDetecting ? (
              <SkeletonLine className="h-2.5 w-32" />
            ) : (
              portfolioLabel
            )}
            {canToggleCurrency && (
              <button
                type="button"
                onClick={() =>
                  setDisplayCurrency((currency) =>
                    currency === "LOCAL" ? "USD" : "LOCAL",
                  )
                }
                className="ml-1 cursor-pointer rounded-full border border-black/10 bg-primary-99 px-1.5 py-0.5 text-[9px] font-bold text-primary-50 transition hover:border-black/20 hover:text-primary-30 dark:border-white/10 dark:bg-transparent dark:text-gray-40 dark:hover:text-white md:border-black/10 md:bg-primary-99 md:text-[8px] md:text-primary-50 md:hover:text-primary-30 md:dark:border-white/10 md:dark:bg-white/5 md:dark:text-primary-80 md:dark:hover:text-primary-90"
              >
                {isLocalDisplay ? "USD" : localCurrency}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsBalanceVisible((visible) => !visible)}
            className="hidden cursor-pointer rounded-full border border-black/10 bg-white/85 p-1.5 text-primary-50 shadow-sm shadow-primary-90/20 transition hover:border-black/20 hover:bg-primary-99 hover:text-primary-30 md:block md:dark:border-white/10 md:dark:bg-white/10 md:dark:text-white/70 md:dark:shadow-none md:dark:hover:bg-white/15 md:dark:hover:text-white"
            aria-label={isBalanceVisible ? "Hide balances" : "Show balances"}
          >
            {isBalanceVisible ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>

        <div className="relative flex flex-1 flex-col justify-start self-stretch pt-1 md:justify-center md:pt-0 min-[1024px]:justify-start min-[1024px]:pt-1">
          <div
            className="group cursor-pointer select-none"
            onClick={() => setIsBalanceVisible((visible) => !visible)}
          >
            <div className="flex items-center justify-start gap-3">
              {isPortfolioLoading && isBalanceVisible ? (
                <SkeletonLine className="h-10 w-44 md:h-16 md:w-72 lg:h-20 lg:w-80" />
              ) : (
                <h2 className="text-3xl font-bold leading-none text-cryptoNight transition-opacity group-active:opacity-70 dark:text-white md:max-w-[11ch] md:text-5xl min-[1024px]:text-3xl">
                  {isBalanceVisible
                    ? activeBalanceLabel
                    : hiddenActiveBalanceLabel}
                </h2>
              )}
            </div>

            {isPortfolioLoading && isBalanceVisible ? (
              <SkeletonLine className="mt-3 h-4 w-24 md:w-32" />
            ) : (
              <p className="mt-1 text-xs font-semibold text-gray-20 dark:text-gray-40 md:mt-2 md:max-w-xl md:text-base md:dark:text-white/70 min-[1024px]:mt-1 min-[1024px]:text-sm">
                {isBalanceVisible
                  ? secondaryBalanceLabel
                  : hiddenSecondaryBalanceLabel}
              </p>
            )}
          </div>
        </div>

        <div className="hidden md:grid md:grid-cols-2 md:gap-3 md:pt-5 min-[1024px]:absolute min-[1024px]:right-4 min-[1024px]:top-1/2 min-[1024px]:w-[46%] min-[1024px]:-translate-y-1/2 min-[1024px]:gap-2 min-[1024px]:pt-0 lg:gap-2 lg:pt-0">
          <div className="rounded-xl border border-black/10 bg-white/75 p-3 shadow-sm shadow-primary-90/15 backdrop-blur dark:border-white/10 dark:bg-secondary-50 dark:shadow-none min-[1024px]:p-2 lg:p-2">
            <p className="text-[10px] font-bold tracking-tight text-gray-30 dark:text-white/35">
              Total Holdings
            </p>
            <p className="mt-1 text-sm font-semibold text-cryptoNight dark:text-white">
              {assetCountLabel}
            </p>
          </div>

          <div className="rounded-xl border border-black/10 bg-white/75 p-3 shadow-sm shadow-primary-90/15 backdrop-blur dark:border-white/10 dark:bg-secondary-50 dark:shadow-none min-[1024px]:p-2 lg:p-2">
            <p className="text-[10px] font-bold tracking-tight text-gray-30 dark:text-white/35">
              Supported networks
            </p>
            <p className="mt-1 text-sm font-semibold text-cryptoNight dark:text-white">
              {totalNetworks === 1 ? "1 network" : `${totalNetworks} networks`}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
