import Link from "next/link";
import { ChevronRight, CreditCard } from "lucide-react";
import AssetNetworkIcon from "@/components/wallet/AssetNetworkIcon";
import type { StockListing } from "@/services/api/stocks";
import type { YieldOpportunity } from "@/types/db";
import { formatApy, getProtocolName } from "@/components/earn/earn-utils";

interface MobileFeaturedOpportunitiesProps {
  stockListings: StockListing[];
  yieldOpportunities: YieldOpportunity[];
}

function ticker(symbol: string) {
  const withoutProviderSuffix = symbol.trim().replace(/[bc]$/i, "");
  return (withoutProviderSuffix.startsWith("b")
    ? withoutProviderSuffix.slice(1)
    : withoutProviderSuffix
  ).toUpperCase();
}

function stockLogo(stock: StockListing) {
  return (
    stock.logoUrl ||
    `https://images.financialmodelingprep.com/symbol/${encodeURIComponent(ticker(stock.symbol))}.png`
  );
}

export default function MobileFeaturedOpportunities({
  stockListings,
  yieldOpportunities,
}: MobileFeaturedOpportunitiesProps) {
  const featuredStocks = Array.from(
    new Map(stockListings.map((stock) => [ticker(stock.symbol), stock])).values(),
  ).slice(0, 5);
  const featuredYield = yieldOpportunities.slice(0, 5);

  return (
    <>
      {featuredStocks.length ? (
        <section className="order-4 min-[1024px]:hidden">
          <SectionHeading href="/earn?category=stocks" title="Stock" />
          <div className="mr-[calc(50%_-_50vw)] flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {featuredStocks.map((stock) => (
              <Link
                key={`${stock.provider}:${stock.symbol}`}
                href={`/earn/stocks/${encodeURIComponent(ticker(stock.symbol))}?provider=${encodeURIComponent(stock.provider)}`}
                className="flex min-h-[100px] w-[39%] min-w-[142px] shrink-0 snap-start flex-col rounded-xl border border-black/10 bg-white/60 p-2.5 transition-colors hover:bg-primary-99/80 dark:border-white/10 dark:bg-secondary-50/50 dark:hover:bg-secondary-60/60"
              >
                <div className="flex items-center gap-2">
                  <span className="relative grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border border-black/10 bg-white text-[8px] font-bold text-primary-70 dark:border-white/10 dark:bg-secondary-60">
                    {ticker(stock.symbol).slice(0, 2)}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={stockLogo(stock)}
                      alt={`${ticker(stock.symbol)} logo`}
                      className="absolute inset-0 h-full w-full bg-white object-contain p-0.5"
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                      }}
                    />
                  </span>
                  <span className="min-w-0 truncate text-xs font-bold text-cryptoNight dark:text-white">
                    {ticker(stock.symbol)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 flex-1 text-[9px] leading-[0.875rem] text-gray-500 dark:text-gray-40">
                  {stock.name}
                </p>
                <p className="mt-2 truncate text-xs font-bold text-cryptoNight dark:text-white min-[360px]:text-sm">
                  ${Number(stock.price || 0).toFixed(2)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="order-5 min-[1024px]:hidden">
        <div className="rounded-xl border border-primary-70/30 bg-gradient-to-br from-primary-95 via-white to-primary-90/10 p-4 dark:from-primary-70/30 dark:via-secondary-50 dark:to-secondary-60">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-cryptoNight dark:text-white">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-70 text-white">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
              </span>
              <h2 className="text-sm font-bold">Kellon Card</h2>
            </div>
            <span className="rounded-full bg-primary-70 px-2 py-1 text-[10px] font-bold text-white">
              Coming soon
            </span>
          </div>
          <p className="mt-3 text-sm font-medium text-cryptoNight dark:text-white">
            Spend from your Kellon wallet, anywhere.
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-40">
            A smarter way to use your stablecoins is on the way.
          </p>
          <div className="mt-4 inline-flex rounded-full bg-black/[0.04] px-3 py-2 text-xs font-semibold text-gray-500 dark:bg-white/[0.08] dark:text-gray-40">
            Card updates coming soon
          </div>
        </div>
      </section>

      {featuredYield.length ? (
        <section className="order-6 min-[1024px]:hidden">
          <SectionHeading href="/earn?category=yield" title="Yield" />
          <div className="mr-[calc(50%_-_50vw)] flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {featuredYield.map((opportunity) => (
              <Link
                key={opportunity.id}
                href={`/earn?category=yield&opportunity=${encodeURIComponent(opportunity.id)}`}
                className="flex min-h-[100px] w-[39%] min-w-[142px] shrink-0 snap-start flex-col rounded-xl border border-black/10 bg-white/60 p-2.5 transition-colors hover:bg-primary-99/80 dark:border-white/10 dark:bg-secondary-50/50 dark:hover:bg-secondary-60/60"
              >
                <div className="flex items-center gap-2">
                  <AssetNetworkIcon
                    symbol={opportunity.symbol}
                    network={opportunity.chain}
                    className="h-7 w-7 [&>div:first-child]:h-7 [&>div:first-child]:w-7 [&>div:last-child]:h-3 [&>div:last-child]:w-3"
                  />
                  <span className="min-w-0 truncate text-xs font-bold text-cryptoNight dark:text-white">
                    {getProtocolName(opportunity.protocol)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 flex-1 text-[9px] leading-[0.875rem] text-gray-500 dark:text-gray-40">
                  {opportunity.symbol} · {opportunity.chain}
                </p>
                <p className="mt-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 min-[360px]:text-sm">
                  {formatApy(opportunity.apy)} APY
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function SectionHeading({ href, title }: { href: string; title: string }) {
  return (
    <Link
      href={href}
      className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-cryptoNight dark:text-white"
    >
      {title}
      <ChevronRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
