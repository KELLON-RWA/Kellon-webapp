"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  stocksService,
} from "@/services/api/stocks";
import type { User } from "@/types/db";
import StockActionDialog, { type StockActionType } from "./StockActionDialog";
import {
  formatUsd,
  getStockSettlementChain,
} from "./earn-utils";
import {
  getDisplayStockName,
  getListingChange,
  getStockLogoUrl,
  getUnderlyingTicker,
  StockLogo,
} from "./EarnPage";
import { getStockCharts } from "./StockSparkline";

const TIME_RANGES = ["1D", "1W", "1M", "1Y", "ALL"] as const;

const STOCK_DESCRIPTIONS: Record<string, string> = {
  AAPL: "Apple Inc. is an American multinational technology company known for the iPhone, Mac, iPad, Apple Watch, and services including the App Store and Apple Music.",
  AMZN: "Amazon.com, Inc. is a multinational technology company focused on e-commerce, cloud computing, digital streaming, and artificial intelligence.",
  GOOGL: "Alphabet Inc. is the parent company of Google and businesses spanning search, advertising, cloud computing, and artificial intelligence.",
  META: "Meta Platforms, Inc. builds products that help people connect and share, including Facebook, Instagram, WhatsApp, and virtual reality products.",
  MSFT: "Microsoft Corporation develops software, cloud services, devices, and artificial intelligence products for people and businesses worldwide.",
  NFLX: "Netflix, Inc. is an entertainment service offering films, series, and games to members around the world.",
};

function StockPriceChart({
  values,
  timestamps,
  className,
}: {
  values?: number[];
  timestamps?: number[];
  className?: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const chartId = useId().replace(/:/g, "");
  if (!values || values.length < 2) {
    return <div className={cn("h-48 animate-pulse rounded-xl bg-gray-90/70 dark:bg-white/5", className)} />;
  }

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 94 - ((value - minimum) / range) * 80;
      return `${x},${y}`;
    })
    .join(" ");
  const area = `0,100 ${points} 100,100`;
  const isUp = values.at(-1)! >= values[0];
  const activeIndex = hoveredIndex === null ? values.length - 1 : hoveredIndex;
  const activeValue = values[activeIndex];
  const activeX = (activeIndex / (values.length - 1)) * 100;
  const activeY = 94 - ((activeValue - minimum) / range) * 80;
  const amountChange = activeValue - values[0];
  const percentageChange = values[0] > 0 ? (amountChange / values[0]) * 100 : 0;
  const activeTimestamp = timestamps?.[activeIndex];
  const tooltipTime = activeTimestamp
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(activeTimestamp * 1000))
    : `Point ${activeIndex + 1}`;
  const axisIndices = [0, 0.33, 0.66, 1].map((position) =>
    Math.round(position * (values.length - 1)),
  );
  const axisSpanDays = timestamps?.length
    ? ((timestamps.at(-1) || 0) - (timestamps[0] || 0)) / 86_400
    : 0;
  const axisDate = (timestamp?: number) => {
    if (!timestamp) return "";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      ...(axisSpanDays < 2
        ? { hour: "numeric" as const }
        : axisSpanDays < 70
          ? { day: "numeric" as const }
          : axisSpanDays < 400
            ? {}
            : { year: "numeric" as const }),
    }).format(new Date(timestamp * 1000));
  };
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    setHoveredIndex(Math.round(position * (values.length - 1)));
  };

  return (
    <div className={cn("grid grid-rows-[minmax(0,1fr)_24px]", isUp ? "text-emerald-500" : "text-rose-500", className)}>
      <div className="relative min-h-0">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="h-full w-full touch-none"
          aria-label={`${isUp ? "Rising" : "Falling"} price trend. Hover to inspect a quote.`}
          role="img"
          tabIndex={0}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHoveredIndex(null)}
          onPointerDown={onPointerMove}
        >
        <defs>
          <linearGradient id={`stock-chart-fill-${chartId}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[18, 50, 82].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="currentColor" strokeOpacity="0.09" />)}
        <polygon points={area} fill={`url(#stock-chart-fill-${chartId})`} />
        <polyline fill="none" points={points} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.35" vectorEffect="non-scaling-stroke" />
        {hoveredIndex !== null ? <line x1={activeX} x2={activeX} y1="4" y2="94" stroke="currentColor" strokeOpacity="0.5" vectorEffect="non-scaling-stroke" /> : null}
        </svg>
        {hoveredIndex !== null ? (
          <span
            className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current ring-2 ring-white dark:ring-secondary-50"
            style={{ left: `${activeX}%`, top: `${activeY}%` }}
            aria-hidden="true"
          />
        ) : null}
        {hoveredIndex !== null ? (
          <div
            className="pointer-events-none absolute top-3 z-10 min-w-40 rounded-lg border border-gray-80 bg-white/95 px-3 py-2 text-left shadow-lg backdrop-blur dark:border-white/10 dark:bg-secondary-50/95"
            style={{ left: `${Math.min(76, Math.max(1, activeX - 9))}%` }}
            aria-live="polite"
          >
            <p className="text-xs text-gray-30 dark:text-gray-40">{tooltipTime}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-cryptoNight dark:text-white">{formatUsd(activeValue)}</p>
            <p className={cn("mt-0.5 text-xs font-semibold tabular-nums", amountChange >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>
              {amountChange >= 0 ? "+" : ""}{formatUsd(amountChange)} ({percentageChange >= 0 ? "+" : ""}{percentageChange.toFixed(2)}%)
            </p>
          </div>
        ) : null}
      </div>
      {timestamps?.length ? (
        <div className="pointer-events-none flex items-end justify-between text-[11px] text-gray-30 dark:text-gray-40" aria-hidden="true">
          {axisIndices.map((index) => <span key={index}>{axisDate(timestamps[index])}</span>)}
        </div>
      ) : null}
    </div>
  );
}

function DesktopMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "accent";
}) {
  return (
    <div className="min-w-0 px-3 first:pl-0 last:pr-0">
      <p className="text-xs text-gray-30 dark:text-gray-40">{label}</p>
      <p
        className={cn(
          "mt-2 truncate text-sm font-semibold",
          tone === "positive"
            ? "text-emerald-600 dark:text-emerald-300"
            : tone === "accent"
              ? "text-primary-90 dark:text-primary-30"
              : "text-cryptoNight dark:text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export default function StockDetailsPage({
  profile,
  symbol,
}: {
  profile: User;
  symbol: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedProvider = searchParams.get("provider")?.toLowerCase();
  const [activeRange, setActiveRange] = useState<(typeof TIME_RANGES)[number]>("1M");
  const [stockAction, setStockAction] = useState<StockActionType | null>(null);
  const normalizedSymbol = getUnderlyingTicker(symbol, requestedProvider);
  const { data: stocks = [], isLoading, refetch } = useQuery({
    queryKey: ["available-stocks"],
    queryFn: async () => (await stocksService.getAvailableStocks("all")).data,
    staleTime: 60_000,
  });
  const stock = useMemo(
    () =>
      stocks.find(
        (item) =>
          getUnderlyingTicker(item.symbol, item.provider) === normalizedSymbol &&
          (!requestedProvider || item.provider.toLowerCase() === requestedProvider),
      ) ||
      stocks.find(
        (item) =>
          getUnderlyingTicker(item.symbol, item.provider) === normalizedSymbol,
      ),
    [normalizedSymbol, requestedProvider, stocks],
  );
  const { data: stockPortfolio, refetch: refetchPortfolio } = useQuery({
    queryKey: ["stock-portfolio"],
    queryFn: async () => (await stocksService.getPortfolio()).data,
    staleTime: 30_000,
  });
  const holding = useMemo(
    () =>
      (stockPortfolio?.holdings || []).find(
        (item) =>
          getUnderlyingTicker(item.symbol, item.provider) === normalizedSymbol &&
          (!requestedProvider ||
            item.provider.toLowerCase() === requestedProvider),
      ) || null,
    [normalizedSymbol, requestedProvider, stockPortfolio?.holdings],
  );
  const canSell = Number(holding?.shares || 0) > 0;
  const { data: chartData } = useQuery({
    queryKey: ["stock-charts", stock?.symbol, stock?.provider, activeRange],
    queryFn: () =>
      getStockCharts(
        stock ? [getUnderlyingTicker(stock.symbol, stock.provider)] : [],
        activeRange,
      ),
    enabled: Boolean(stock),
    staleTime: 60_000,
  });
  const { data: dayChartData } = useQuery({
    queryKey: ["stock-charts", stock?.symbol, stock?.provider, "1D"],
    queryFn: () =>
      getStockCharts(
        stock ? [getUnderlyingTicker(stock.symbol, stock.provider)] : [],
        "1D",
      ),
    enabled: Boolean(stock),
    staleTime: 60_000,
  });
  const chartTicker = stock
    ? getUnderlyingTicker(stock.symbol, stock.provider)
    : undefined;
  const values = chartTicker ? chartData?.charts?.[chartTicker] : undefined;
  const timestamps = chartTicker
    ? chartData?.timestamps?.[chartTicker]
    : undefined;
  const change = stock
    ? getListingChange(
        stock,
        chartTicker ? dayChartData?.changes?.[chartTicker] : undefined,
      )
    : undefined;
  const chartStats = chartTicker
    ? dayChartData?.stats?.[chartTicker]
    : undefined;
  const chartHigh = chartStats?.high24h || Number(stock?.price || 0);
  const chartLow = chartStats?.low24h || Number(stock?.price || 0);

  if (!isLoading && !stock) {
    return (
      <main className="container mx-auto flex min-h-[70dvh] max-w-2xl items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-lg font-bold text-cryptoNight dark:text-white">Stock not found</h1>
          <Button className="mt-4" variant="outline" onClick={() => router.push("/earn?category=stocks")}>Back to stocks</Button>
        </div>
      </main>
    );
  }

  const title = stock ? getUnderlyingTicker(stock.symbol) : normalizedSymbol;
  const name = stock ? getDisplayStockName(stock.name) : "Loading stock";
  const price = Number(stock?.price || 0);
  const isPositive = (change || 0) >= 0;
  const description = STOCK_DESCRIPTIONS[title] || `${name} is available as a tokenized stock on Kellon, with on-chain settlement and 24/7 access.`;

  return (
    <main className="container mx-auto min-h-[100dvh] w-full max-w-7xl px-4 pb-52 pt-4 md:px-6 md:pb-12 md:pt-28">
      <header className="mb-5 flex items-center justify-between md:mb-7">
        <button type="button" onClick={() => router.back()} aria-label="Back to stock opportunities" className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-50/70 text-cryptoNight transition hover:bg-primary-90/10 hover:text-primary-90 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-primary-30">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold text-cryptoNight dark:text-white">{title}</h1>
        <button type="button" onClick={() => refetch()} aria-label="Refresh stock data" className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary-50/70 text-cryptoNight transition hover:bg-primary-90/10 hover:text-primary-90 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-primary-30">
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>

      <div className="hidden md:block">
        <div className="mb-5 flex items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-4">
            <StockLogo
              symbol={title}
              src={stock ? getStockLogoUrl(stock.symbol, stock.logoUrl) : undefined}
            />
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-cryptoNight dark:text-white">{title}</h2>
              <p className="truncate text-sm text-gray-30 dark:text-gray-40">{name} · Tokenized stock</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canSell ? (
              <Button type="button" variant="outline" className="h-11 px-6" onClick={() => setStockAction("sell")}>
                Sell {title}
              </Button>
            ) : null}
            <Button type="button" variant="flow" className="h-11 px-7" disabled={!stock} onClick={() => setStockAction("buy")}>
              <span className="relative z-10">Buy {title}</span>
              <span aria-hidden="true" className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
            </Button>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-gray-80 bg-white/70 p-7 dark:border-white/10 dark:bg-secondary-50/60">
          <div className="flex items-start justify-between gap-8">
            <div>
              <p className="text-4xl font-semibold tabular-nums text-cryptoNight dark:text-white">{formatUsd(price)}</p>
              {change !== undefined ? (
                <p className={cn("mt-2 text-sm font-semibold", isPositive ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>
                  {isPositive ? "+" : ""}{change.toFixed(2)}% <span className="font-normal text-gray-30 dark:text-gray-40">in the last 24 hours</span>
                </p>
              ) : null}
            </div>
            <div className="flex rounded-lg bg-secondary-50/70 p-1 dark:bg-black/20">
              {TIME_RANGES.map((range) => (
                <button key={range} type="button" onClick={() => setActiveRange(range)} className={cn("rounded-md px-4 py-2 text-xs font-semibold transition", activeRange === range ? "bg-primary-90 text-white shadow-sm dark:bg-primary-70" : "text-gray-30 hover:text-cryptoNight dark:text-gray-40 dark:hover:text-white")}>
                  {range}
                </button>
              ))}
            </div>
          </div>
          <StockPriceChart values={values} timestamps={timestamps} className="mt-5 h-[300px]" />
          <div className="mt-3 grid grid-cols-6 border-t border-gray-80 pt-5 dark:border-white/10">
            <DesktopMetric label="24h high" value={formatUsd(chartHigh)} />
            <DesktopMetric label="24h low" value={formatUsd(chartLow)} />
            <DesktopMetric label="Collateral" value="1:1 Regulated Trust" tone="positive" />
            <DesktopMetric label="Trading hours" value="24/7 On-Chain" tone="accent" />
            <DesktopMetric label="Settlement" value={stock ? getStockSettlementChain(stock.provider, stock.settlementChain || stock.chain || stock.network).toUpperCase() : "BASE"} />
            <DesktopMetric label="Asset standard" value="ERC-20 Tokenized" />
          </div>
        </section>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold text-cryptoNight dark:text-white">About {name}</h2>
          <div className="rounded-2xl border border-gray-80 bg-white/70 p-5 text-sm leading-6 text-gray-30 dark:border-white/10 dark:bg-secondary-50/60 dark:text-gray-40">{description}</div>
        </section>
      </div>

      <div className="md:hidden">
      <section className="rounded-2xl border border-gray-80 bg-white/70 p-5 dark:border-white/10 dark:bg-secondary-50/60 md:col-start-2 md:row-start-1 md:sticky md:top-28 md:p-6">
        <div className="flex items-center gap-3 border-b border-gray-80 pb-4 dark:border-white/10">
          <StockLogo symbol={title} src={stock ? getStockLogoUrl(stock.symbol, stock.logoUrl) : undefined} />
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-cryptoNight dark:text-white">{title}</h2>
            <p className="truncate text-sm text-gray-30 dark:text-gray-40">{name}</p>
          </div>
        </div>
        <div className="mt-5 flex items-end justify-between gap-4">
          <p className="text-3xl font-semibold tabular-nums text-cryptoNight dark:text-white">{formatUsd(price)}</p>
          {change !== undefined ? <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", isPositive ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "bg-rose-500/10 text-rose-600 dark:text-rose-300")}>
            {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {isPositive ? "+" : ""}{change.toFixed(2)}% (24h)
          </span> : null}
        </div>
        <div className="mt-6 hidden border-t border-gray-80 pt-5 dark:border-white/10 md:block">
          <div className="mb-4 flex items-center justify-between gap-3 text-xs">
            <span className="text-gray-30 dark:text-gray-40">Settlement</span>
            <span className="font-semibold text-cryptoNight dark:text-white">
              {stock
                ? getStockSettlementChain(stock.provider, stock.settlementChain || stock.chain || stock.network).toUpperCase()
                : "BASE"} · Tokenized
            </span>
          </div>
          <Button
            type="button"
            variant="flow"
            className="h-12 w-full"
            disabled={!stock}
            onClick={() => setStockAction("buy")}
          >
            <span className="relative z-10">Buy {title}</span>
          </Button>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-gray-80 bg-white/70 p-5 dark:border-white/10 dark:bg-secondary-50/60 md:col-start-1 md:row-start-1 md:mt-0 md:p-6">
        <p className="text-2xl font-semibold tabular-nums text-cryptoNight dark:text-white">{formatUsd(price)}</p>
        {change !== undefined ? <p className={cn("mt-1 text-sm font-medium", isPositive ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>{isPositive ? "+" : ""}{change.toFixed(2)}%</p> : null}
        <StockPriceChart values={values} timestamps={timestamps} />
        <div className="mt-1 grid grid-cols-5 border-t border-gray-80 pt-3 dark:border-white/10">
          {TIME_RANGES.map((range) => <button key={range} type="button" onClick={() => setActiveRange(range)} className={cn("rounded-md py-1.5 text-xs font-medium transition", activeRange === range ? "bg-primary-90/10 text-primary-90 dark:bg-primary-70/20 dark:text-primary-30" : "text-gray-30 hover:text-cryptoNight dark:text-gray-40 dark:hover:text-white")}>{range}</button>)}
        </div>
      </section>

      <section className="mt-5 md:col-start-2 md:row-start-2 md:mt-6">
        <h2 className="mb-3 text-sm font-bold text-cryptoNight dark:text-white">Key statistics</h2>
        <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-gray-80 bg-white/70 dark:border-white/10 dark:bg-secondary-50/60">
          <Stat label="24h high" value={formatUsd(chartHigh)} />
          <Stat label="24h low" value={formatUsd(chartLow)} bordered />
          <Stat label="Collateral & backing" value="1:1 Regulated Trust" tone="positive" />
          <Stat label="Trading hours" value="24/7 On-Chain" tone="accent" bordered />
          <Stat label="Settlement network" value={stock ? getStockSettlementChain(stock.provider, stock.settlementChain || stock.chain || stock.network).toUpperCase() : "BASE"} />
          <Stat label="Asset standard" value="ERC-20 Tokenized" bordered />
        </div>
      </section>

      <section className="mt-5 md:col-start-1 md:row-start-2 md:mt-6">
        <h2 className="mb-3 text-sm font-bold text-cryptoNight dark:text-white">About {name}</h2>
        <div className="rounded-2xl border border-gray-80 bg-white/70 p-5 text-sm leading-6 text-gray-30 dark:border-white/10 dark:bg-secondary-50/60 dark:text-gray-40">{description}</div>
      </section>

      </div>

      <div className="fixed inset-x-0 bottom-[76px] z-30 flex gap-3 p-4 md:hidden">
        {canSell ? (
          <Button type="button" variant="outline" className="h-14 flex-1" onClick={() => setStockAction("sell")}>Sell {title}</Button>
        ) : null}
        <Button type="button" variant="flow" className="h-14 flex-1" disabled={!stock} onClick={() => setStockAction("buy")}><span className="relative z-10">Buy {title}</span></Button>
      </div>

      <StockActionDialog
        action={stockAction || "buy"}
        stock={stock || null}
        holding={holding}
        profile={profile}
        open={Boolean(stockAction)}
        onOpenChange={(open) => {
          if (!open) setStockAction(null);
        }}
        onComplete={async () => {
          await Promise.all([refetch(), refetchPortfolio()]);
        }}
      />
    </main>
  );
}

function Stat({ label, value, tone, bordered = false }: { label: string; value: string; tone?: "positive" | "accent"; bordered?: boolean }) {
  return <div className={cn("min-h-20 px-4 py-4 text-center", bordered && "border-l border-gray-80 dark:border-white/10")}><p className="text-[11px] text-gray-30 dark:text-gray-40">{label}</p><p className={cn("mt-1 text-xs font-semibold", tone === "positive" ? "text-emerald-600 dark:text-emerald-300" : tone === "accent" ? "text-primary-90 dark:text-primary-30" : "text-cryptoNight dark:text-white")}>{value}</p></div>;
}
