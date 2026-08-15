"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import AssetNetworkIcon from "@/components/wallet/AssetNetworkIcon";
import { formatApy, toNumber } from "@/components/earn/earn-utils";
import { yieldService } from "@/services/api/yield";

export default function EarnPreviewPanel() {
  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ["yield-opportunities"],
    queryFn: async () => (await yieldService.getOpportunities()).data,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const featuredOpportunities = [...opportunities]
    .sort((left, right) => toNumber(right.apy) - toNumber(left.apy))
    .slice(0, 4);

  if (!isLoading && featuredOpportunities.length === 0) return null;

  return (
    <section
      aria-labelledby="dashboard-earn-heading"
      className="order-4 min-w-0 space-y-4 min-[900px]:order-none min-[900px]:col-span-full min-[1024px]:hidden"
    >
      <Link
        href="/earn"
        className="group inline-flex items-center gap-1 text-black dark:text-white"
      >
        <h3
          id="dashboard-earn-heading"
          className="text-[15px] font-semibold leading-tight tracking-normal md:text-base"
        >
          Earn
        </h3>
        <ChevronRight
          aria-hidden="true"
          className="h-5 w-5 transition-transform group-hover:translate-x-0.5"
        />
      </Link>

      <div className="mr-[calc(50%_-_50vw)] flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {isLoading
          ? [0, 1, 2].map((item) => (
              <div
                key={item}
                aria-hidden="true"
                className="h-40 w-[45%] min-w-[168px] max-w-[210px] shrink-0 animate-pulse snap-start rounded-xl border border-black/10 bg-white/70 dark:border-white/10 dark:bg-secondary-50 md:h-44 md:min-w-[190px]"
              />
            ))
          : featuredOpportunities.map((opportunity) => (
              <Link
                key={opportunity.id}
                href="/earn"
                aria-label={`Earn ${formatApy(opportunity.apy)} APY on ${opportunity.symbol}`}
                className="flex h-40 w-[45%] min-w-[168px] max-w-[210px] shrink-0 snap-start flex-col justify-between rounded-xl border border-black/10 bg-white/80 p-4 shadow-sm shadow-primary-90/10 transition-colors hover:border-black/20 hover:bg-primary-99/80 dark:border-white/10 dark:bg-secondary-50 dark:shadow-none dark:hover:bg-secondary-60/50 md:h-44 md:min-w-[190px]"
              >
                <AssetNetworkIcon
                  symbol={opportunity.symbol}
                  network={opportunity.chain}
                  size="sm"
                  className="w-fit self-start"
                />

                <div>
                  <p className="text-lg font-semibold text-black dark:text-white md:text-xl">
                    {formatApy(opportunity.apy)} APY
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    on {opportunity.symbol.toUpperCase()}
                  </p>
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
}
