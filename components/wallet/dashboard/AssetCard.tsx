import { FC } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AssetCardProps {
  name: string;
  symbol: string;
  amount: string;
  value: string;
  hideBalances?: boolean;
  isValueLoading?: boolean;
  href?: string;
  iconUrl?: string;
  subtitle?: string;
  compact?: boolean;
  className?: string;
}

const AssetCard: FC<AssetCardProps> = ({
  name,
  symbol,
  amount,
  value,
  hideBalances,
  isValueLoading,
  href,
  iconUrl,
  subtitle,
  compact = false,
  className,
}) => {
  const defaultIconUrl = `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`;

  return (
    <Link
      href={href || `/assets/${symbol.toLowerCase()}`}
      className={cn(
        compact
          ? "group flex w-full min-w-0 cursor-pointer items-center justify-between gap-2.5 rounded-lg p-2.5 transition-all"
          : "group flex w-full min-w-0 cursor-pointer items-center justify-between gap-3 rounded-xl p-3 transition-all xs:gap-4 xs:p-4 md:rounded-lg md:p-4 lg:p-6",
        "border border-black/10 bg-white/80 shadow-primary-90/10 hover:border-black/20 hover:bg-primary-99/80",
        "dark:bg-secondary-50 dark:border-white/10 dark:hover:bg-secondary-60/50 ",
        className,
      )}
    >
      <div className={cn("flex min-w-0 flex-1 items-center", compact ? "gap-2.5" : "gap-3 xs:gap-4 lg:gap-5")}>
        {/* Real Crypto Icon Container */}
        <div className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 shadow-sm shadow-primary-90/20 dark:border-white/5 dark:shadow-none", compact ? "h-8 w-8" : "h-10 w-10 xs:h-12 xs:w-12 lg:h-14 lg:w-14")}>
          <span className="text-xs font-bold text-primary-90 dark:text-primary-30">
            {symbol.slice(0, 2).toUpperCase()}
          </span>
          {iconUrl ? (
            // Stock provider logos are remote and use a native image so an
            // unavailable logo can fall back to the ticker initials.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={iconUrl}
              alt={`${symbol} logo`}
              className="absolute inset-0 h-full w-full bg-white object-contain p-1 dark:bg-secondary-60"
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          ) : (
            <Image
              src={defaultIconUrl}
              alt={symbol}
              width={40}
              height={40}
              className="absolute inset-0 h-full w-full object-contain"
            />
          )}
        </div>

        <div className="min-w-0">
          <p className={cn("truncate text-black transition-colors dark:text-white", compact ? "text-sm" : "text-sm xs:text-base lg:text-lg")}>
            {name}
          </p>
          <p className="mt-0.5 truncate text-[10px] font-medium tracking-normal text-gray-500 dark:text-gray-400 lg:text-xs">
            {subtitle || (
              <>
                {symbol} <span aria-hidden="true">·</span> Multi-chain
              </>
            )}
          </p>
        </div>
      </div>

      <div className={cn("shrink-0 text-right", compact ? "min-w-[48px]" : "min-w-[52px] xs:min-w-[64px]")}>
        <p className={cn("text-black dark:text-white", compact ? "text-sm" : "text-base xs:text-lg lg:text-xl")}>
          {hideBalances ? "••••" : amount}
        </p>
        {isValueLoading && !hideBalances ? (
          <span className="mt-1 block h-3 w-16 animate-pulse rounded-full bg-gray-100 dark:bg-secondary-60 lg:h-3.5 lg:w-20" />
        ) : (
          <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 xs:text-xs lg:text-sm">
            {hideBalances ? "••••••" : value}
          </p>
        )}
      </div>
    </Link>
  );
};

export default AssetCard;
