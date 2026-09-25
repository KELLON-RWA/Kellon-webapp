"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Building2,
  ExternalLink,
  Landmark,
  MapPin,
  RefreshCw,
  Scale,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Vote,
  WalletCards,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
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
import { getStockCharts, type StockChartRange } from "./StockSparkline";

const TIME_RANGES = ["1D", "1W", "1M", "1Y", "ALL"] as const;

const STOCK_DESCRIPTIONS: Record<string, string> = {
  AAPL: "Apple Inc. is an American multinational technology company known for the iPhone, Mac, iPad, Apple Watch, and services including the App Store and Apple Music.",
  AMZN: "Amazon.com, Inc. is a multinational technology company focused on e-commerce, cloud computing, digital streaming, and artificial intelligence.",
  GOOGL: "Alphabet Inc. is the parent company of Google and businesses spanning search, advertising, cloud computing, and artificial intelligence.",
  META: "Meta Platforms, Inc. builds products that help people connect and share, including Facebook, Instagram, WhatsApp, and virtual reality products.",
  MSFT: "Microsoft Corporation develops software, cloud services, devices, and artificial intelligence products for people and businesses worldwide.",
  NFLX: "Netflix, Inc. is an entertainment service offering films, series, and games to members around the world.",
};

type CompanyProfile = {
  website: string;
  sector: string;
  industry: string;
  ceo?: string;
  headquarters?: string;
  founded?: string;
  employees?: string;
};

const COMPANY_PROFILES: Record<string, CompanyProfile> = {
  AAPL: {
    website: "https://www.apple.com",
    sector: "Technology",
    industry: "Consumer electronics",
    ceo: "Tim Cook",
    headquarters: "Cupertino, California, USA",
    founded: "1976",
    employees: "161,000",
  },
  AMZN: { website: "https://www.aboutamazon.com", sector: "Consumer cyclical", industry: "Internet retail", ceo: "Andy Jassy", headquarters: "Seattle, Washington, USA", founded: "1994" },
  GOOGL: { website: "https://abc.xyz", sector: "Communication services", industry: "Internet content & information", ceo: "Sundar Pichai", headquarters: "Mountain View, California, USA", founded: "2015" },
  META: { website: "https://about.meta.com", sector: "Communication services", industry: "Internet content & information", ceo: "Mark Zuckerberg", headquarters: "Menlo Park, California, USA", founded: "2004" },
  MSFT: { website: "https://www.microsoft.com", sector: "Technology", industry: "Software", ceo: "Satya Nadella", headquarters: "Redmond, Washington, USA", founded: "1975" },
  NFLX: { website: "https://about.netflix.com", sector: "Communication services", industry: "Entertainment", ceo: "Greg Peters & Ted Sarandos", headquarters: "Los Gatos, California, USA", founded: "1997" },
};

const STOCK_PAGE_TABS = ["Charts", "Company", "Token info", "Data"] as const;
const STOCKHOLDER_TABS = ["Tokenholder rights", "My positions", "Activities"] as const;
type StockPageTab = (typeof STOCK_PAGE_TABS)[number];
type StockholderTab = (typeof STOCKHOLDER_TABS)[number];

function StockPriceChart({
  values,
  timestamps,
  selectedRange,
  className,
}: {
  values?: number[];
  timestamps?: number[];
  selectedRange?: StockChartRange;
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
        ...(selectedRange === "ALL" ? { year: "numeric" as const } : {}),
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
              ? "text-primary-60 dark:text-primary-60"
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
  const requestedNetwork = searchParams.get("network")?.toLowerCase();
  useEffect(() => {
    if (!requestedProvider || requestedNetwork) return;

    const network = getStockSettlementChain(requestedProvider);
    router.replace(
      `/earn/stocks/${encodeURIComponent(getUnderlyingTicker(symbol, requestedProvider))}?network=${network}`,
      { scroll: false },
    );
  }, [requestedNetwork, requestedProvider, router, symbol]);
  const [activeRange, setActiveRange] = useState<(typeof TIME_RANGES)[number]>("1M");
  const [stockAction, setStockAction] = useState<StockActionType | null>(null);
  const [activeTab, setActiveTab] = useState<StockPageTab>("Charts");
  const [activeStockholderTab, setActiveStockholderTab] = useState<StockholderTab>("Tokenholder rights");
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
          (!requestedProvider || item.provider.toLowerCase() === requestedProvider) &&
          (!requestedNetwork ||
            getStockSettlementChain(
              item.provider,
              item.settlementChain || item.chain || item.network,
            ) === requestedNetwork),
      ) ||
      stocks.find(
        (item) =>
          getUnderlyingTicker(item.symbol, item.provider) === normalizedSymbol &&
          (!requestedNetwork ||
            getStockSettlementChain(
              item.provider,
              item.settlementChain || item.chain || item.network,
            ) === requestedNetwork),
      ),
    [normalizedSymbol, requestedNetwork, requestedProvider, stocks],
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
            item.provider.toLowerCase() === requestedProvider) &&
          (!requestedNetwork ||
            getStockSettlementChain(item.provider) === requestedNetwork),
      ) || null,
    [normalizedSymbol, requestedNetwork, requestedProvider, stockPortfolio?.holdings],
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
  const company = COMPANY_PROFILES[title];
  const settlementChain = stock
    ? getStockSettlementChain(stock.provider, stock.settlementChain || stock.chain || stock.network).toUpperCase()
    : "BASE";
  const providerName = stock?.provider || "Verified provider";

  return (
    <main className="container mx-auto min-h-[100dvh] w-full max-w-7xl px-4 pb-52 pt-4 md:px-6 md:pb-12 md:pt-28">
      <header className="mb-5 flex items-center justify-between md:mb-7">
        <button type="button" onClick={() => router.back()} aria-label="Back to stock opportunities" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-gray-100 text-slate-600 transition-colors hover:bg-gray-200 dark:border-transparent dark:bg-secondary-60/50 dark:text-white dark:hover:bg-secondary-60">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold text-cryptoNight dark:text-white">{title}</h1>
        <button type="button" onClick={() => refetch()} aria-label="Refresh stock data" className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-gray-100 text-slate-600 transition-colors hover:bg-gray-200 dark:border-transparent dark:bg-secondary-60/50 dark:text-white dark:hover:bg-secondary-60">
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>

      <nav className="mb-5 grid grid-cols-4 gap-1 rounded-xl border border-gray-80 bg-white/70 p-1.5 dark:border-white/10 dark:bg-secondary-50/60" aria-label="Stock information">
        {STOCK_PAGE_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "min-h-9 rounded-lg px-1 text-[10px] font-semibold transition min-[360px]:px-2 min-[360px]:text-xs sm:text-sm",
              activeTab === tab
                ? "bg-gradient-to-r from-primary-70 to-primary-60 text-white dark:bg-primary-70 dark:bg-none"
                : "text-gray-30 hover:bg-gray-90 dark:text-gray-40 dark:hover:bg-white/10",
            )}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === "Charts" ? (
        <>
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
            <div className="flex rounded-lg border border-gray-80 bg-white/70 p-1 dark:border-white/10 dark:bg-black/20">
              {TIME_RANGES.map((range) => (
                <button key={range} type="button" onClick={() => setActiveRange(range)} className={cn("rounded-md px-4 py-2 text-xs font-semibold transition", activeRange === range ? "bg-gradient-to-r from-primary-70 to-primary-60 text-white dark:bg-primary-70 dark:bg-none" : "text-gray-30 hover:text-cryptoNight dark:text-gray-40 dark:hover:text-white")}>
                  {range}
                </button>
              ))}
            </div>
          </div>
          <StockPriceChart values={values} timestamps={timestamps} selectedRange={activeRange} className="mt-5 h-[300px]" />
          <div className="mt-3 grid grid-cols-6 border-t border-gray-80 pt-5 dark:border-white/10">
            <DesktopMetric label="24h high" value={formatUsd(chartHigh)} />
            <DesktopMetric label="24h low" value={formatUsd(chartLow)} />
            <DesktopMetric label="Collateral" value="1:1 Regulated Trust" tone="positive" />
            <DesktopMetric label="Trading hours" value="24/7 On-Chain" tone="accent" />
            <DesktopMetric label="Settlement" value={stock ? getStockSettlementChain(stock.provider, stock.settlementChain || stock.chain || stock.network).toUpperCase() : "BASE"} />
            <DesktopMetric label="Asset standard" value="ERC-20 Tokenized" />
          </div>
        </section>

      </div>

      <div className="md:hidden">
      <section className="rounded-2xl border border-gray-80 bg-white/70 p-4 dark:border-white/10 dark:bg-secondary-50/60 md:col-start-2 md:row-start-1 md:sticky md:top-28 md:p-6">
        <div className="flex items-center gap-3 border-b border-gray-80 pb-3 dark:border-white/10">
          <StockLogo symbol={title} src={stock ? getStockLogoUrl(stock.symbol, stock.logoUrl) : undefined} />
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-cryptoNight dark:text-white">{title}</h2>
            <p className="truncate text-sm text-gray-30 dark:text-gray-40">{name}</p>
          </div>
        </div>
        <div className="mt-4 flex items-end justify-between gap-4">
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

      <section className="mt-5 rounded-2xl border border-gray-80 bg-white/70 p-4 dark:border-white/10 dark:bg-secondary-50/60 md:col-start-1 md:row-start-1 md:mt-0 md:p-6">
        <p className="text-2xl font-semibold tabular-nums text-cryptoNight dark:text-white">{formatUsd(price)}</p>
        {change !== undefined ? <p className={cn("mt-1 text-sm font-medium", isPositive ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>{isPositive ? "+" : ""}{change.toFixed(2)}%</p> : null}
        <StockPriceChart values={values} timestamps={timestamps} selectedRange={activeRange} className="h-[240px]" />
        <div className="mt-1 grid grid-cols-5 border-t border-gray-80 pt-3 dark:border-white/10">
          {TIME_RANGES.map((range) => <button key={range} type="button" onClick={() => setActiveRange(range)} className={cn("rounded-md py-1.5 text-xs font-medium transition", activeRange === range ? "bg-gradient-to-r from-primary-70 to-primary-60 text-white dark:bg-primary-70 dark:bg-none" : "text-gray-30 hover:text-cryptoNight dark:text-gray-40 dark:hover:text-white")}>{range}</button>)}
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

      </div>
      <StockholderInformation
        activeTab={activeStockholderTab}
        onTabChange={setActiveStockholderTab}
        title={title}
        holding={holding}
      />
        </>
      ) : (
        <StockResearchContent
          tab={activeTab}
          title={title}
          description={description}
          company={company}
          provider={providerName}
          settlementChain={settlementChain}
          price={price}
          chartHigh={chartHigh}
          chartLow={chartLow}
        />
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-80 bg-white/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-secondary-50/95 md:hidden">
        <div className={cn("mx-auto grid max-w-3xl gap-3", canSell ? "grid-cols-2" : "grid-cols-1")}>
          {canSell ? (
            <Button type="button" variant="outline" className="h-12" onClick={() => setStockAction("sell")}>Sell {title}</Button>
          ) : null}
          <Button type="button" variant="flow" className="h-12" disabled={!stock} onClick={() => setStockAction("buy")}><span className="relative z-10">Buy {title}</span></Button>
        </div>
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

function StockResearchContent({
  tab,
  title,
  description,
  company,
  provider,
  settlementChain,
  price,
  chartHigh,
  chartLow,
}: {
  tab: Exclude<StockPageTab, "Charts">;
  title: string;
  description: string;
  company?: CompanyProfile;
  provider: string;
  settlementChain: string;
  price: number;
  chartHigh: number;
  chartLow: number;
}) {
  if (tab === "Company") {
    return (
      <section className="rounded-2xl border border-gray-80 bg-white/70 p-5 dark:border-white/10 dark:bg-secondary-50/60 md:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-xl font-bold text-cryptoNight dark:text-white">{title}</h2>
          <span className="rounded-full border border-primary-60/40 bg-primary-70/5 px-2.5 py-1 text-xs font-semibold text-primary-60 dark:bg-primary-70/10 dark:text-primary-60">{company?.sector || "Public equity"}</span>
          <span className="rounded-full border border-primary-60/40 bg-primary-70/5 px-2.5 py-1 text-xs font-semibold text-primary-60 dark:bg-primary-70/10 dark:text-primary-60">{company?.industry || "Tokenized stock"}</span>
        </div>
        <p className="mt-5 max-w-3xl text-sm leading-6 text-gray-30 dark:text-gray-40">{description}</p>
        {company?.website ? (
          <a href={company.website} target="_blank" rel="noreferrer" className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary-60/40 text-sm font-semibold text-primary-60 transition hover:bg-primary-70/10 dark:border-primary-60/40 dark:text-primary-60 sm:w-auto sm:px-6">
            Visit official website <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
        <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-gray-80 bg-gray-80 sm:grid-cols-2 dark:border-white/10 dark:bg-white/10">
          <CompanyFact icon={<Building2 className="h-4 w-4" />} label="Chief executive" value={company?.ceo || "Not available"} />
          <CompanyFact icon={<MapPin className="h-4 w-4" />} label="Headquarters" value={company?.headquarters || "Not available"} />
          <CompanyFact icon={<Landmark className="h-4 w-4" />} label="Founded" value={company?.founded || "Not available"} />
          <CompanyFact icon={<Users className="h-4 w-4" />} label="Employees" value={company?.employees || "Not available"} />
        </div>
      </section>
    );
  }

  if (tab === "Token info") {
    return (
      <section className="rounded-2xl border border-gray-80 bg-white/70 p-5 dark:border-white/10 dark:bg-secondary-50/60 md:p-7">
        <h2 className="text-xl font-bold text-cryptoNight dark:text-white">Token specifications</h2>
        <div className="mt-5 flex gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 text-sm text-gray-30 dark:text-gray-40">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
          <div><p className="font-semibold text-cryptoNight dark:text-white">Tokenized equity via {provider}</p><p className="mt-1 leading-5">This listing represents exposure to the underlying public company through a tokenized-stock provider. Review the provider disclosures before purchase.</p></div>
        </div>
        <div className="mt-5 divide-y divide-gray-80 rounded-xl border border-gray-80 px-4 dark:divide-white/10 dark:border-white/10">
          <InfoRow label="Listing provider" value={provider} />
          <InfoRow label="Settlement network" value={settlementChain} />
          <InfoRow label="Token standard" value="ERC-20 tokenized equity" />
          <InfoRow label="Collateral & backing" value="Provider disclosure required" tone="positive" />
          <InfoRow label="Trading hours" value="24/7 on-chain" />
          <InfoRow label="Contract address" value="Shown in purchase confirmation" />
        </div>
        <p className="mt-4 text-xs leading-5 text-gray-30 dark:text-gray-40">Kellon shows the provider and settlement network for each listing. The definitive custody, redemption, and token-contract terms are supplied by the selected provider at purchase.</p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-80 bg-white/70 p-5 dark:border-white/10 dark:bg-secondary-50/60 md:p-7">
        <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-bold text-cryptoNight dark:text-white">Market & valuation data</h2><p className="mt-1 text-sm text-gray-30 dark:text-gray-40">Live data available for this tokenized listing.</p></div><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-current" />Live</span></div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          <DataMetric label="Current price" value={formatUsd(price)} />
          <DataMetric label="24h high" value={formatUsd(chartHigh)} />
          <DataMetric label="24h low" value={formatUsd(chartLow)} />
          <DataMetric label="Market cap" value="From market-data feed" />
          <DataMetric label="Trading volume" value="From market-data feed" />
          <DataMetric label="52-week range" value="From market-data feed" />
        </div>
      </section>
      <section className="rounded-2xl border border-gray-80 bg-white/70 p-5 dark:border-white/10 dark:bg-secondary-50/60 md:p-7">
        <div className="flex gap-3"><Activity className="mt-0.5 h-5 w-5 shrink-0 text-primary-60 dark:text-primary-60" /><div><h2 className="font-bold text-cryptoNight dark:text-white">On-chain holder analytics</h2><p className="mt-1 text-sm leading-6 text-gray-30 dark:text-gray-40">Holder concentration, wallet distribution, and inflows will appear here when they are supplied by the selected provider.</p></div></div>
      </section>
    </div>
  );
}

function StockholderInformation({ activeTab, onTabChange, title, holding }: { activeTab: StockholderTab; onTabChange: (tab: StockholderTab) => void; title: string; holding: { shares: number } | null }) {
  return (
    <section className="mt-5 md:mt-7">
      <div className="grid grid-cols-3 rounded-xl border border-gray-80 bg-white/70 p-1.5 dark:border-white/10 dark:bg-secondary-50/60">
        {STOCKHOLDER_TABS.map((tab) => <button key={tab} type="button" onClick={() => onTabChange(tab)} className={cn("min-h-10 rounded-lg px-2 text-[11px] font-semibold transition sm:text-sm", activeTab === tab ? "bg-gradient-to-r from-primary-70 to-primary-60 text-white dark:bg-primary-70 dark:bg-none" : "text-gray-30 hover:bg-gray-90 dark:text-gray-40 dark:hover:bg-white/10")}>{tab}</button>)}
      </div>
      <div className="mt-4 rounded-2xl border border-gray-80 bg-white/70 p-5 dark:border-white/10 dark:bg-secondary-50/60 md:p-7">
        {activeTab === "Tokenholder rights" ? <><h2 className="text-lg font-bold text-cryptoNight dark:text-white">Tokenholder protections & rights</h2><div className="mt-5 grid gap-5 md:grid-cols-2"><RightItem icon={<Scale className="h-5 w-5" />} title="Economic exposure" text={`Token holders receive market exposure to ${title} through the selected tokenized-stock provider.`} /><RightItem icon={<WalletCards className="h-5 w-5" />} title="Dividend treatment" text="Dividend and corporate-action treatment is governed by the selected provider’s listing terms." /><RightItem icon={<Vote className="h-5 w-5" />} title="Voting rights disclosure" text="Tokenized equities may not carry direct voting rights. Review provider disclosures before purchase." /><RightItem icon={<ShieldCheck className="h-5 w-5" />} title="Custody & insolvency terms" text="Custody and redemption protections are defined by the provider’s verified token documentation." /></div></> : activeTab === "My positions" ? <div className="py-8 text-center"><WalletCards className="mx-auto h-9 w-9 text-gray-30 dark:text-gray-40" /><h2 className="mt-3 text-lg font-bold text-cryptoNight dark:text-white">{holding ? `${holding.shares} ${title} shares held` : "No active position"}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-30 dark:text-gray-40">{holding ? "Your current position is available above in the sell action." : `You do not own any ${title} tokenized shares yet.`}</p></div> : <div className="py-8 text-center"><Activity className="mx-auto h-9 w-9 text-gray-30 dark:text-gray-40" /><h2 className="mt-3 text-lg font-bold text-cryptoNight dark:text-white">Recent activity</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-30 dark:text-gray-40">Your purchases, sales, and provider distributions for {title} will appear here.</p></div>}
      </div>
    </section>
  );
}

function CompanyFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="bg-white/70 p-4 dark:bg-secondary-50/60"><div className="flex items-center gap-2 text-gray-30 dark:text-gray-40">{icon}<span className="text-xs">{label}</span></div><p className="mt-2 text-sm font-semibold text-cryptoNight dark:text-white">{value}</p></div>; }
function InfoRow({ label, value, tone }: { label: string; value: string; tone?: "positive" }) { return <div className="flex items-center justify-between gap-4 py-3.5 text-sm"><span className="text-gray-30 dark:text-gray-40">{label}</span><span className={cn("max-w-[60%] text-right font-semibold", tone === "positive" ? "text-emerald-600 dark:text-emerald-300" : "text-cryptoNight dark:text-white")}>{value}</span></div>; }
function DataMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-secondary-50/70 p-4 dark:bg-white/5"><p className="text-xs text-gray-30 dark:text-gray-40">{label}</p><p className="mt-2 text-sm font-semibold text-cryptoNight dark:text-white">{value}</p></div>; }
function RightItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary-60/35 bg-primary-70/5 text-primary-60 dark:bg-primary-70/10 dark:text-primary-60">{icon}</span><div><h3 className="text-sm font-semibold text-cryptoNight dark:text-white">{title}</h3><p className="mt-1 text-sm leading-5 text-gray-30 dark:text-gray-40">{text}</p></div></div>; }

function Stat({ label, value, tone, bordered = false }: { label: string; value: string; tone?: "positive" | "accent"; bordered?: boolean }) {
  return <div className={cn("min-h-20 px-4 py-4 text-center", bordered && "border-l border-gray-80 dark:border-white/10")}><p className="text-[11px] text-gray-30 dark:text-gray-40">{label}</p><p className={cn("mt-1 text-xs font-semibold", tone === "positive" ? "text-emerald-600 dark:text-emerald-300" : tone === "accent" ? "text-primary-60 dark:text-primary-60" : "text-cryptoNight dark:text-white")}>{value}</p></div>;
}
