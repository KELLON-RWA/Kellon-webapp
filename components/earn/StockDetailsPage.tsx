"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  BarChart2,
  CandlestickChart,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  Info,
  Layers,
  LineChart,
  Lock,
  RefreshCw,
  Scale,
  ShieldCheck,
  Star,
  TrendingDown,
  TrendingUp,
  Vote,
  WalletCards,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import HydrationSafeRelativeTime from "@/components/HydrationSafeRelativeTime";
import {
  getStockTransactionFiatAmount,
  getStockTransactionShares,
  getTransactionAmountLabel,
  getTransactionStatusClasses,
  getTransactionStatusLabel,
  getTransactionSymbol,
  getTransactionTitle,
} from "@/lib/dashboard-utils";
import { getActivityRefetchInterval } from "@/lib/transaction-polling";
import { transactionService } from "@/services/api/transactions";
import {
  stockResearchService,
  type DexScreenerPool,
  type FinnhubMarketData,
  type StockTradingData,
} from "@/services/api/stock-research";
import type { CompanyNewsArticle } from "@/lib/company-news";
import { formatNewsTimestamp, getCompanyNewsName } from "@/lib/company-news";
import type { NewsCompanyFacts } from "@/lib/company-news-facts";
import type { WikidataCompanyProfile } from "@/lib/wikidata-company";
import { DANGOTE_COMPANY_PROFILE } from "@/lib/dangote-company-profile";
import CompanyNewsThumbnail from "@/components/earn/CompanyNewsThumbnail";
import { isRwaStockListing, stocksService, type StockListing } from "@/services/api/stocks";
import type { Transaction, User } from "@/types/db";
import StockActionDialog, { type StockActionType } from "./StockActionDialog";
import StockNairaPrice from "./StockNairaPrice";
import StockTradingChart, {
  type ChartType,
  type HoveredData,
  type IndicatorType,
} from "./StockTradingChart";
import StockDesktopSidebar from "./StockDesktopSidebar";
import { useStockRealtime } from "@/hooks/useStockRealtime";
import {
  formatUsd,
  getStockProviderLabel,
  getStockSettlementChain,
  resolveStockCategory,
  resolveVisibleTimeframes,
} from "./earn-utils";
import {
  getDisplayStockName,
  getDisplayStockSymbol,
  getListingChange,
  getStockLogoUrl,
  StockSymbol,
  getUnderlyingTicker,
  StockLogo,
} from "./EarnPage";

const STOCK_PAGE_TABS = ["Charts", "Company", "News", "Token Info", "Data"] as const;
type StockPageTab = (typeof STOCK_PAGE_TABS)[number];

const PINNED_TIMEFRAMES = ["Time", "15m", "1h", "4h", "1D", "1W"] as const;
const AVAILABLE_TIMEFRAMES = [
  "1s",
  "1m",
  "3m",
  "5m",
  "30m",
  "2h",
  "6h",
  "8h",
  "12h",
  "1M",
] as const;

function getListingSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function formatCompactVolume(value: number) {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }
  return value.toLocaleString();
}

function formatCompactTurnover(value: number) {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }
  return `$${value.toLocaleString()}`;
}

const STOCK_DESCRIPTIONS: Record<string, string> = {
  AAPL: "Apple Inc. is an American multinational technology company headquartered in Cupertino, California, in Silicon Valley, and known for consumer electronics, software and online services. Founded in 1976 as Apple Computer Company by Steve Jobs, Steve Wozniak and Ronald Wayne, the company was incorporated by Jobs and Wozniak as Apple Computer, Inc. the following year. Its current name was adopted in 2007 as the company expanded its focus from computers to consumer electronics. Apple is one of the Big Tech companies.",
  AMZN: "Amazon.com, Inc. is an American multinational technology company focusing on e-commerce, cloud computing, online advertising, digital streaming, and artificial intelligence. Founded by Jeff Bezos in 1994, Amazon started as an online marketplace for books and has since expanded into a wide variety of product categories, earning it the moniker 'The Everything Store'.",
  GOOGL:
    "Alphabet Inc. is an American multinational technology conglomerate holding company headquartered in Mountain View, California. It was created through a restructuring of Google on October 2, 2015, and became the parent company of Google and several former Google subsidiaries, spanning internet search, cloud computing, software, and autonomous vehicles.",
  META: "Meta Platforms, Inc., doing business as Meta, is an American multinational technology conglomerate based in Menlo Park, California. The company owns and operates Facebook, Instagram, Threads, and WhatsApp, among other products and services. Meta is considered one of the Big Tech companies alongside Apple, Alphabet, Amazon, and Microsoft.",
  MSFT: "Microsoft Corporation is an American multinational corporation and technology company headquartered in Redmond, Washington. Best known for software products including the Windows line of operating systems, the Microsoft 365 suite, and the Edge web browser, Microsoft also produces hardware, cloud computing services through Azure, and gaming consoles with Xbox.",
  NFLX: "Netflix, Inc. is an American media company based in Los Gatos, California. Founded in 1997 by Reed Hastings and Marc Randolph, it offers a subscription-based video-on-demand service featuring films and television series from various genres, including in-house Netflix Originals.",
  NVDA: "NVIDIA Corporation is an American multinational corporation and technology company headquartered in Santa Clara, California. It designs graphics processing units (GPUs) for the gaming and professional markets, as well as system on a chip units (SoCs) for mobile computing and automotive markets, and is a dominant supplier of artificial intelligence hardware and software.",
  TSLA: "Tesla, Inc. is an American multinational automotive and clean energy company headquartered in Austin, Texas. Tesla designs, manufactures, and sells electric vehicles, stationary battery energy storage systems, solar panels, and related products and services.",
  COIN: "Coinbase Global, Inc. operates a cryptocurrency exchange platform. The company provides financial infrastructure and technology for the crypto economy, offering retail users and institutions a platform to buy, sell, and store digital assets securely.",
  AMC: "AMC Entertainment Holdings, Inc. is an American theatrical exhibition company headquartered in Leawood, Kansas. Founded in 1920, it is the largest movie theater chain in the world, with thousands of screens across the United States and Europe.",
  INTC: "Intel Corporation is an American multinational corporation and technology company headquartered in Santa Clara, California. It is one of the world's largest semiconductor chip manufacturers by revenue and the developer of the x86 microprocessors found in the majority of personal computers.",
};

type CompanyProfile = {
  name?: string;
  description?: string;
  facts?: Array<{ label: string; value: string }>;
  sources?: Array<{ label: string; url: string }>;
  reviewedAt?: string;
  website: string;
  sector: string;
  industry: string;
  ceo?: string;
  headquarters?: string;
  founded?: string;
  employees?: string;
};

const COMPANY_PROFILES: Record<string, CompanyProfile> = {
  DPRI: DANGOTE_COMPANY_PROFILE,
  AAPL: {
    website: "https://www.apple.com",
    sector: "Technology",
    industry: "Consumer electronics",
    ceo: "Tim Cook",
    headquarters: "Cupertino, California, USA",
    founded: "1976",
    employees: "161,000",
    description:
      "Apple Inc. is an American multinational technology company headquartered in Cupertino, California, in Silicon Valley, and known for consumer electronics, software and online services. Founded in 1976 as Apple Computer Company by Steve Jobs, Steve Wozniak and Ronald Wayne, the company was incorporated by Jobs and Wozniak as Apple Computer, Inc. the following year. Its current name was adopted in 2007 as the company expanded its focus from computers to consumer electronics. Apple is one of the Big Tech companies.",
  },
  AMZN: {
    website: "https://aboutamazon.com",
    sector: "Consumer cyclical",
    industry: "Internet retail",
    ceo: "Andy Jassy",
    headquarters: "Seattle, Washington, USA",
    founded: "1994",
  },
  GOOGL: {
    website: "https://abc.xyz",
    sector: "Communication services",
    industry: "Internet content & information",
    ceo: "Sundar Pichai",
    headquarters: "Mountain View, California, USA",
    founded: "2015",
  },
  META: {
    website: "https://about.meta.com",
    sector: "Communication services",
    industry: "Internet content & information",
    ceo: "Mark Zuckerberg",
    headquarters: "Menlo Park, California, USA",
    founded: "2004",
  },
  MSFT: {
    website: "https://www.microsoft.com",
    sector: "Technology",
    industry: "Software",
    ceo: "Satya Nadella",
    headquarters: "Redmond, Washington, USA",
    founded: "1975",
  },
  NFLX: {
    website: "https://about.netflix.com",
    sector: "Communication services",
    industry: "Entertainment",
    ceo: "Greg Peters & Ted Sarandos",
    headquarters: "Los Gatos, California, USA",
    founded: "1997",
  },
  NVDA: {
    website: "https://www.nvidia.com",
    sector: "Technology",
    industry: "Semiconductors",
    ceo: "Jensen Huang",
    headquarters: "Santa Clara, California, USA",
    founded: "1993",
    employees: "29,600",
    description:
      "NVIDIA Corporation is an American multinational corporation and technology company headquartered in Santa Clara, California. It designs graphics processing units (GPUs) for the gaming and professional markets, as well as system on a chip units (SoCs) for mobile computing and automotive markets, and is a dominant supplier of artificial intelligence hardware and software.",
  },
  TSLA: {
    website: "https://www.tesla.com",
    sector: "Consumer cyclical",
    industry: "Automotive",
    ceo: "Elon Musk",
    headquarters: "Austin, Texas, USA",
    founded: "2003",
    employees: "140,473",
    description:
      "Tesla, Inc. is an American multinational automotive and clean energy company headquartered in Austin, Texas. Tesla designs, manufactures, and sells electric vehicles, stationary battery energy storage systems, solar panels, and related products and services.",
  },
  AMC: {
    website: "https://www.amctheatres.com",
    sector: "Communication Services",
    industry: "Entertainment / Movie Theaters",
    ceo: "Adam Aron",
    headquarters: "Leawood, Kansas, USA",
    founded: "1920",
    employees: "26,000+",
  },
  INTC: {
    website: "https://www.intel.com",
    sector: "Technology",
    industry: "Semiconductors",
    ceo: "Pat Gelsinger",
    headquarters: "Santa Clara, California, USA",
    founded: "1968",
    employees: "124,800+",
  },
};

type CompanyFinancials = {
  marketCap?: string;
  peRatio?: string;
  dividendYield?: string;
  volume24h?: string;
  avgVolume?: string;
  range52w?: string;
  revenueTTM?: string;
  revenueGrowth?: string;
  grossMargin?: string;
  operatingMargin?: string;
  netProfitMargin?: string;
  eps?: string;
  roe?: string;
  debtEquity?: string;
  priceBook?: string;
  beta?: string;
};

const COMPANY_FINANCIAL_FALLBACKS: Record<string, CompanyFinancials> = {
  AAPL: {
    marketCap: "$4.98 Trillion",
    peRatio: "37.7x",
    dividendYield: "0.51%",
    volume24h: "$7.29M",
    avgVolume: "42.8M shares",
    range52w: "$243.42 - $360.83",
    revenueTTM: "—",
    revenueGrowth: "+15.06%",
    grossMargin: "48.79%",
    operatingMargin: "33.01%",
    netProfitMargin: "27.60%",
    eps: "$8.98",
    roe: "127.61%",
    debtEquity: "0.71",
    priceBook: "44.06x",
    beta: "1.03",
  },
  MSFT: {
    marketCap: "$3.15 Trillion",
    peRatio: "34.2x",
    dividendYield: "0.74%",
    volume24h: "$5.84M",
    avgVolume: "21.5M shares",
    range52w: "$385.00 - $468.35",
    revenueTTM: "$245.1B",
    revenueGrowth: "+16.00%",
    grossMargin: "69.80%",
    operatingMargin: "44.60%",
    netProfitMargin: "35.30%",
    eps: "$11.80",
    roe: "38.50%",
    debtEquity: "0.38",
    priceBook: "11.20x",
    beta: "0.89",
  },
  NVDA: {
    marketCap: "$3.35 Trillion",
    peRatio: "45.1x",
    dividendYield: "0.03%",
    volume24h: "$12.45M",
    avgVolume: "52.3M shares",
    range52w: "$75.60 - $149.77",
    revenueTTM: "$96.3B",
    revenueGrowth: "+122.40%",
    grossMargin: "75.10%",
    operatingMargin: "62.10%",
    netProfitMargin: "55.30%",
    eps: "$2.95",
    roe: "115.40%",
    debtEquity: "0.15",
    priceBook: "48.20x",
    beta: "1.68",
  },
  AMZN: {
    marketCap: "$2.15 Trillion",
    peRatio: "42.8x",
    dividendYield: "—",
    volume24h: "$8.12M",
    avgVolume: "38.1M shares",
    range52w: "$144.05 - $215.90",
    revenueTTM: "$604.3B",
    revenueGrowth: "+11.00%",
    grossMargin: "48.20%",
    operatingMargin: "9.80%",
    netProfitMargin: "7.70%",
    eps: "$4.67",
    roe: "21.80%",
    debtEquity: "0.58",
    priceBook: "8.40x",
    beta: "1.15",
  },
  GOOGL: {
    marketCap: "$2.20 Trillion",
    peRatio: "24.5x",
    dividendYield: "0.45%",
    volume24h: "$6.34M",
    avgVolume: "24.6M shares",
    range52w: "$130.66 - $191.75",
    revenueTTM: "$328.3B",
    revenueGrowth: "+14.00%",
    grossMargin: "57.50%",
    operatingMargin: "32.00%",
    netProfitMargin: "27.80%",
    eps: "$7.54",
    roe: "30.50%",
    debtEquity: "0.11",
    priceBook: "6.80x",
    beta: "1.05",
  },
  META: {
    marketCap: "$1.45 Trillion",
    peRatio: "26.3x",
    dividendYield: "0.35%",
    volume24h: "$4.89M",
    avgVolume: "14.2M shares",
    range52w: "$314.50 - $602.95",
    revenueTTM: "$156.2B",
    revenueGrowth: "+22.00%",
    grossMargin: "81.50%",
    operatingMargin: "41.20%",
    netProfitMargin: "35.80%",
    eps: "$21.50",
    roe: "33.70%",
    debtEquity: "0.24",
    priceBook: "8.90x",
    beta: "1.21",
  },
  TSLA: {
    marketCap: "$1.10 Trillion",
    peRatio: "88.4x",
    dividendYield: "—",
    volume24h: "$15.60M",
    avgVolume: "68.4M shares",
    range52w: "$138.80 - $358.64",
    revenueTTM: "$97.1B",
    revenueGrowth: "+8.00%",
    grossMargin: "17.90%",
    operatingMargin: "8.20%",
    netProfitMargin: "7.10%",
    eps: "$3.95",
    roe: "18.20%",
    debtEquity: "0.09",
    priceBook: "14.50x",
    beta: "2.32",
  },
  AMD: {
    marketCap: "$225.40 Billion",
    peRatio: "112.5x",
    dividendYield: "—",
    volume24h: "$4.20M",
    avgVolume: "48.2M shares",
    range52w: "$130.00 - $227.30",
    revenueTTM: "$24.3B",
    revenueGrowth: "+18.00%",
    grossMargin: "50.10%",
    operatingMargin: "11.20%",
    netProfitMargin: "9.50%",
    eps: "$1.28",
    roe: "5.40%",
    debtEquity: "0.04",
    priceBook: "3.95x",
    beta: "1.72",
  },
  AMC: {
    marketCap: "$1.25 Billion",
    peRatio: "—",
    dividendYield: "—",
    volume24h: "$2.64M",
    avgVolume: "14.8M shares",
    range52w: "$2.38 - $13.78",
    revenueTTM: "$4.81B",
    revenueGrowth: "+2.50%",
    grossMargin: "18.20%",
    operatingMargin: "2.10%",
    netProfitMargin: "-3.80%",
    eps: "-$0.82",
    roe: "-18.40%",
    debtEquity: "3.85",
    priceBook: "1.15x",
    beta: "2.45",
  },
  INTC: {
    marketCap: "$102.50 Billion",
    peRatio: "—",
    dividendYield: "1.85%",
    volume24h: "$12.40M",
    avgVolume: "54.2M shares",
    range52w: "$18.51 - $51.28",
    revenueTTM: "$54.2B",
    revenueGrowth: "-1.00%",
    grossMargin: "40.50%",
    operatingMargin: "3.20%",
    netProfitMargin: "1.80%",
    eps: "$0.45",
    roe: "3.80%",
    debtEquity: "0.45",
    priceBook: "0.95x",
    beta: "1.15",
  },
};

function matchesStockActivity(
  transaction: Transaction,
  stockSymbol: string,
  underlyingTicker: string,
  provider?: string,
) {
  if (!["BUY", "SELL"].includes(transaction.type)) return false;

  const transactionSymbol = String(transaction.symbol || "").toUpperCase();
  const resolvedSymbol = getTransactionSymbol(transaction).toUpperCase();
  const normalizedStockSymbol = stockSymbol.toUpperCase();
  const matchesExactListing = transactionSymbol === normalizedStockSymbol;
  const matchesUnderlying =
    getUnderlyingTicker(transactionSymbol) === underlyingTicker ||
    getUnderlyingTicker(resolvedSymbol) === underlyingTicker;

  if (!matchesExactListing && !matchesUnderlying) return false;
  if (matchesExactListing || !provider) return true;

  const metadata = JSON.stringify(transaction.metadata || {}).toLowerCase();
  return metadata.includes(provider.toLowerCase());
}

export default function StockDetailsPage({
  profile,
  symbol,
}: {
  profile: User;
  symbol: string;
}) {
  const router = useRouter();

  // State
  const [activeTab, setActiveTab] = useState<StockPageTab>("Charts");
  const [activeInterval, setActiveInterval] = useState<string>("15m");
  const [chartType, setChartType] = useState<ChartType>("candlestick");
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreDropdownRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const timeframeScrollRef = useRef<HTMLDivElement>(null);
  const activeTimeframeRef = useRef<HTMLButtonElement>(null);

  const visibleTimeframes = useMemo(
    () =>
      resolveVisibleTimeframes(
        PINNED_TIMEFRAMES,
        activeInterval,
        chartType === "candlestick",
      ),
    [chartType, activeInterval],
  );

  useEffect(() => {
    const container = timeframeScrollRef.current;
    const activeEl = activeTimeframeRef.current;
    if (!container || !activeEl) return;

    const containerRect = container.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();

    if (elRect.left < containerRect.left || elRect.right > containerRect.right) {
      activeEl.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeInterval, chartType, visibleTimeframes]);

  useEffect(() => {
    if (!isMoreOpen) return;
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        moreDropdownRef.current &&
        !moreDropdownRef.current.contains(target) &&
        moreButtonRef.current &&
        !moreButtonRef.current.contains(target)
      ) {
        setIsMoreOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMoreOpen]);
  const [watchlist, setWatchlist] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem("kellon_stock_watchlist");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        "kellon_stock_watchlist",
        JSON.stringify(Array.from(watchlist)),
      );
    } catch {}
  }, [watchlist]);

  const [stockAction, setStockAction] = useState<StockActionType | null>(null);
  const [hoveredData, setHoveredData] = useState<HoveredData | null>(null);

  const handleHoverDataChange = useCallback((data: HoveredData | null) => {
    setHoveredData(data);
  }, []);

  // Indicators toggle set (MA and VOL on by default)
  const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorType>>(
    new Set(["MA", "VOL"]),
  );

  const toggleIndicator = (ind: IndicatorType) => {
    setActiveIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(ind)) {
        next.delete(ind);
      } else {
        next.add(ind);
      }
      return next;
    });
  };

  const normalizedSymbol = getUnderlyingTicker(symbol);

  // Queries
  const {
    data: stocks = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["available-stocks"],
    queryFn: async () => {
      const response = await stocksService.getAvailableStocks("all");
      return response.data;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const stockOptions = useMemo(
    () => {
      const target = normalizedSymbol.toUpperCase();
      return stocks.filter((item) => {
        const listingSym = getListingSymbol(item.symbol).toUpperCase();
        const underlying = getUnderlyingTicker(
          item.symbol,
          item.provider,
        ).toUpperCase();
        const rawTicker = (item.ticker || item.symbol || "").toUpperCase();
        return (
          listingSym === target ||
          underlying === target ||
          rawTicker === target ||
          getUnderlyingTicker(item.symbol).toUpperCase() === target
        );
      });
    },
    [normalizedSymbol, stocks],
  );
  const matchedStock = stockOptions[0];
  const stock =
    matchedStock ||
    (normalizedSymbol
      ? ({
          symbol: normalizedSymbol,
          name: `${normalizedSymbol} Tokenized Stock`,
          price: 0,
          currency: "USD",
          provider: "base_b20",
          settlementChain: "BASE",
        } as StockListing)
      : undefined);
  const isRwa = Boolean(stock && isRwaStockListing(stock));

  const underlyingTicker = stock
    ? getUnderlyingTicker(stock.symbol, stock.provider)
    : normalizedSymbol;

  const displayStockSymbol = underlyingTicker || stock?.symbol || normalizedSymbol;
  const name = stock ? getDisplayStockName(stock.name) : "Stock";
  const stockLogoUrl = getStockLogoUrl(displayStockSymbol, stock?.logoUrl);

  const stockActionSymbol = displayStockSymbol;

  const settlementChain = stock
    ? getStockSettlementChain(
        stock.provider,
        stock.settlementChain || stock.chain || stock.network,
      ).toUpperCase()
    : "BASE";

  // Real-time sub-second price and trade stream (Finnhub WebSocket / SSE)
  const realtime = useStockRealtime(displayStockSymbol);

  // Fetch full candles and 24h trading statistics
  const {
    data: tradingData,
    isLoading: isCandlesLoading,
    refetch: refetchCandles,
  } = useQuery({
    queryKey: ["stock-candles", underlyingTicker, activeInterval],
    queryFn: () =>
      stockResearchService.getCandles(
        underlyingTicker,
        activeInterval === "Line" || activeInterval === "Time" ? "15m" : activeInterval,
      ),
    enabled: Boolean(underlyingTicker) && !isRwa,
    staleTime: 10_000,
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
  });

  // Finnhub live market quote and cached company fundamentals
  const { data: exchangeMarketData, refetch: refetchFinnhubMarketData } =
    useQuery({
      queryKey: ["finnhub-stock-market-data", normalizedSymbol],
      queryFn: () =>
        stockResearchService.getFinnhubMarketData(normalizedSymbol),
      enabled: Boolean(stock) && !isRwa,
      staleTime: 5_000,
      gcTime: 5 * 60_000,
      refetchInterval: 10_000,
    });

  const finnhubMarketData = isRwa ? undefined : exchangeMarketData;

  // Company research queries
  const companyNewsName = getCompanyNewsName(stock?.name || "");
  const { data: companyProfileData, refetch: refetchCompanyProfile } = useQuery(
    {
      queryKey: ["wikidata-company-profile", normalizedSymbol, companyNewsName],
      queryFn: () =>
        stockResearchService.getCompanyProfile(
          normalizedSymbol,
          companyNewsName,
        ),
      enabled: !isRwa && Boolean(stock) && activeTab === "Company",
      staleTime: 24 * 60 * 60_000,
    },
  );

  const { data: companyNewsFactsData } = useQuery({
    queryKey: ["company-news-facts", normalizedSymbol, companyNewsName],
    queryFn: () =>
      stockResearchService.getCompanyNewsFacts(
        normalizedSymbol,
        companyNewsName,
      ),
    enabled:
      !isRwa &&
      Boolean(stock) &&
      Boolean(companyNewsName) &&
      (activeTab === "Company" || activeTab === "News"),
    staleTime: 15 * 60_000,
    gcTime: 60 * 60_000,
  });

  const {
    data: companyNewsData,
    isLoading: isCompanyNewsLoading,
    isError: isCompanyNewsError,
    refetch: refetchCompanyNews,
  } = useQuery({
    queryKey: ["company-news", normalizedSymbol, companyNewsName],
    queryFn: () =>
      stockResearchService.getCompanyNews(normalizedSymbol, companyNewsName),
    enabled:
      Boolean(stock) &&
      Boolean(companyNewsName) &&
      (activeTab === "News" || activeTab === "Company"),
    staleTime: 15 * 60_000,
    gcTime: 60 * 60_000,
    refetchInterval: 15 * 60_000,
  });

  // DexScreener query
  const dexListing = stockOptions.find(
    (option) =>
      option.pairAddress ||
      option.poolAddress ||
      option.tokenAddress ||
      option.contractAddress ||
      option.address,
  );
  const dexChain = dexListing
    ? getStockSettlementChain(
        dexListing.provider,
        dexListing.settlementChain || dexListing.chain || dexListing.network,
      )
    : undefined;
  const dexTokenAddress =
    dexListing?.tokenAddress ||
    dexListing?.contractAddress ||
    dexListing?.address;
  const dexPairAddress = dexListing?.pairAddress || dexListing?.poolAddress;

  const {
    data: dexScreenerData,
    isLoading: isDexScreenerLoading,
    refetch: refetchDexScreener,
  } = useQuery({
    queryKey: [
      "dexscreener-stock-pool",
      dexChain,
      dexTokenAddress,
      dexPairAddress,
    ],
    queryFn: () =>
      stockResearchService.getDexScreenerPool({
        chain: dexChain || "",
        tokenAddress: dexTokenAddress,
        pairAddress: dexPairAddress,
      }),
    enabled:
      activeTab === "Data" &&
      Boolean(dexChain && (dexTokenAddress || dexPairAddress)),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // User portfolio & transactions
  const { data: stockPortfolio, refetch: refetchPortfolio } = useQuery({
    queryKey: ["stock-portfolio"],
    queryFn: async () => (await stocksService.getPortfolio()).data,
    staleTime: 30_000,
  });

  const {
    data: accountTransactions = [],
    isLoading: isStockActivitiesLoading,
    refetch: refetchTransactions,
  } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const response = await transactionService.getTransactions();
      return response.data || [];
    },
    staleTime: 5_000,
    refetchInterval: (query) => getActivityRefetchInterval(query.state.data),
  });

  const holding = useMemo(() => {
    const holdings = stockPortfolio?.holdings || [];
    return (
      holdings.find(
        (item) =>
          getListingSymbol(item.symbol) === normalizedSymbol ||
          getUnderlyingTicker(item.symbol, item.provider) === normalizedSymbol,
      ) || null
    );
  }, [normalizedSymbol, stockPortfolio?.holdings]);

  const canSell = Number(holding?.shares || 0) > 0;

  const stockActivities = useMemo(
    () =>
      [...accountTransactions]
        .filter((transaction) =>
          stock
            ? matchesStockActivity(
                transaction,
                stock.symbol,
                normalizedSymbol,
                undefined,
              )
            : false,
        )
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
        ),
    [accountTransactions, normalizedSymbol, stock],
  );

  // Compute average sell price and past sell activities
  const sellTransactions = useMemo(
    () => stockActivities.filter((t) => t.type === "SELL"),
    [stockActivities],
  );

  const avgSellPrice = useMemo(() => {
    let totalSellFiat = 0;
    let totalSellShares = 0;
    for (const t of sellTransactions) {
      const shares = getStockTransactionShares(t) || 0;
      const fiat = getStockTransactionFiatAmount(t) || Number(t.amount || 0);
      if (shares > 0 && fiat > 0) {
        totalSellFiat += fiat;
        totalSellShares += shares;
      }
    }
    return totalSellShares > 0 ? totalSellFiat / totalSellShares : 0;
  }, [sellTransactions]);

  const handleRefreshAll = () => {
    toast.info("Refreshing stock data...");
    void Promise.all([
      refetch(),
      refetchCandles(),
      refetchFinnhubMarketData(),
      refetchPortfolio(),
      refetchTransactions(),
      refetchCompanyProfile(),
      refetchCompanyNews(),
      refetchDexScreener(),
    ]);
  };

  const isWatchlisted = watchlist.has(underlyingTicker);

  const handleToggleWatchlist = useCallback(
    (tickerToToggle?: string) => {
      const target = (tickerToToggle || underlyingTicker).toUpperCase();
      setWatchlist((prev) => {
        const next = new Set(prev);
        if (next.has(target)) {
          next.delete(target);
          toast.success(`Removed ${target} from watchlist`);
        } else {
          next.add(target);
          toast.success(`Added ${target} to watchlist`);
        }
        return next;
      });
    },
    [underlyingTicker],
  );

  if (!isLoading && !stock) {
    return (
      <main className="container mx-auto flex min-h-[70dvh] max-w-2xl items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-lg font-bold text-cryptoNight dark:text-white">
            Stock not found
          </h1>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => router.push("/earn?category=stocks")}
          >
            Back to stocks
          </Button>
        </div>
      </main>
    );
  }

  // Price & Stats (combining snapshot baseline with sub-second real-time stream)
  const basePrice =
    tradingData?.stats?.currentPrice ||
    Number(finnhubMarketData?.quote?.current || stock?.price || 265.61);

  const currentPrice = realtime.price || basePrice;

  const previousClose =
    finnhubMarketData?.quote?.previousClose ||
    (tradingData?.stats?.change24hPercent !== undefined && tradingData.stats.change24hPercent !== -100
      ? basePrice / (1 + tradingData.stats.change24hPercent / 100)
      : basePrice);

  const changePercent =
    previousClose > 0
      ? ((currentPrice - previousClose) / previousClose) * 100
      : (tradingData?.stats?.change24hPercent ??
        finnhubMarketData?.quote?.percentChange ??
        0);

  const isPositive = changePercent >= 0;

  const high24h = Math.max(
    tradingData?.stats?.high24h || finnhubMarketData?.quote?.high || currentPrice,
    currentPrice,
  );

  const low24h = Math.min(
    tradingData?.stats?.low24h || finnhubMarketData?.quote?.low || currentPrice,
    currentPrice,
  );

  const vol24h = tradingData?.stats?.vol24h || 23_670_000;
  const turnover24h = tradingData?.stats?.turnover24h || vol24h * currentPrice;

  // Performance columns
  const performance = tradingData?.performance || {
    today: Number(changePercent.toFixed(2)),
    days7: Number((changePercent * 0.9).toFixed(2)),
    days30: 0.94,
    days90: 2.5,
    days180: -0.46,
  };

  const candles = tradingData?.candles || [];

  return (
    <main className="mx-auto min-h-[100dvh] w-full max-w-[1600px] overflow-x-hidden px-3 sm:px-4 pb-36 pt-4 md:px-6 md:pb-24 md:max-lg:pt-20 lg:max-w-none lg:px-6 lg:pt-3.5 xl:px-8">
      {/* 1. Header Bar */}
      <header className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-80 bg-white/80 text-gray-20 shadow-sm transition hover:bg-white active:scale-95 dark:border-white/10 dark:bg-secondary-60/60 dark:text-white dark:hover:bg-secondary-60 cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-sm font-bold text-cryptoNight sm:text-base dark:text-white">
            {name.replace(/\s*Tokenized Stock$/i, "")} Tokenized Stock
          </h1>
          <p className="truncate text-xs text-gray-20 dark:text-gray-400">
            {displayStockSymbol}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshAll}
            aria-label="Refresh"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-80 bg-white/80 text-gray-20 shadow-sm transition hover:bg-white active:scale-95 lg:hidden dark:border-white/10 dark:bg-secondary-60/60 dark:text-white dark:hover:bg-secondary-60 cursor-pointer"
          >
            <RefreshCw
              className={cn("h-4 w-4 text-gray-400 dark:text-gray-300", isRefetching && "animate-spin")}
            />
          </button>
          <div className="hidden h-10 w-10 lg:block" aria-hidden="true" />
        </div>
      </header>

      {/* 2. Top Tabs: Charts, Company, News, Token Info, Data */}
      <nav
        className="mb-4 flex items-center gap-1 overflow-x-auto no-scrollbar rounded-xl border border-gray-80 bg-white/70 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-secondary-60/40 dark:shadow-none sm:grid sm:grid-cols-5"
        aria-label="Stock tabs"
      >
        {STOCK_PAGE_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "h-9 shrink-0 sm:shrink rounded-lg px-3 sm:px-1 truncate text-xs font-semibold transition sm:text-sm cursor-pointer",
              activeTab === tab
                ? "bg-gradient-to-r from-primary-70 to-primary-60 font-bold text-white shadow-lg shadow-primary-60/20"
                : "text-gray-20 hover:text-cryptoNight hover:bg-gray-90/60 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5",
            )}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Main Grid: Left Column for Chart/Content, Right Column for Binance-style Desktop Sidebar */}
      <div className="grid w-full max-w-full grid-cols-1 gap-6 min-[1200px]:grid-cols-[minmax(0,1fr)_340px] min-[1400px]:grid-cols-[minmax(0,1fr)_380px] min-[1200px]:items-start">
        {/* Left Column: Charts / Company / Token Info / Data content */}
        <div className="min-w-0 w-full max-w-full">
          {activeTab === "Charts" ? (
        <div className="space-y-4 w-full max-w-full">
          {/* 3. Stock Summary Card */}
          <section className="rounded-2xl border border-gray-80 bg-white/80 p-3 sm:p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-secondary-50/70 dark:shadow-lg">
            {/* Top Row: Logo + Symbol + Network Badge + Watchlist Star (Left) & Historical Performance (Right on Desktop) */}
            <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-2 shrink-0">
                <StockLogo symbol={displayStockSymbol} src={stockLogoUrl} size="sm" />
                <span className="text-base font-bold text-cryptoNight sm:text-lg dark:text-white">
                  {displayStockSymbol}
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleWatchlist()}
                  aria-label={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
                  className="group flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-gray-90/80 active:scale-95 dark:hover:bg-white/10 cursor-pointer"
                >
                  <Star
                    className={cn(
                      "h-4 w-4 transition-colors",
                      isWatchlisted
                        ? "fill-primary-50 text-primary-50"
                        : "text-gray-400 group-hover:text-cryptoNight dark:group-hover:text-white",
                    )}
                  />
                </button>
              </div>

              {/* Desktop Performance Metrics: next to logo/heading in top row */}
              <div className="hidden lg:flex items-center gap-5 xl:gap-8 text-right">
                <div>
                  <p className="text-[11px] text-gray-20 dark:text-gray-400">Today</p>
                  <p
                    className={cn(
                      "mt-0.5 text-xs font-bold tabular-nums sm:text-sm",
                      performance.today >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400",
                    )}
                  >
                    {performance.today >= 0 ? "+" : ""}
                    {performance.today.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-20 dark:text-gray-400">7 Days</p>
                  <p
                    className={cn(
                      "mt-0.5 text-xs font-bold tabular-nums sm:text-sm",
                      performance.days7 >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400",
                    )}
                  >
                    {performance.days7 >= 0 ? "+" : ""}
                    {performance.days7.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-20 dark:text-gray-400">30 Days</p>
                  <p
                    className={cn(
                      "mt-0.5 text-xs font-bold tabular-nums sm:text-sm",
                      performance.days30 >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400",
                    )}
                  >
                    {performance.days30 >= 0 ? "+" : ""}
                    {performance.days30.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-20 dark:text-gray-400">90 Days</p>
                  <p
                    className={cn(
                      "mt-0.5 text-xs font-bold tabular-nums sm:text-sm",
                      performance.days90 >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400",
                    )}
                  >
                    {performance.days90 >= 0 ? "+" : ""}
                    {performance.days90.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-20 dark:text-gray-400">180 Days</p>
                  <p
                    className={cn(
                      "mt-0.5 text-xs font-bold tabular-nums sm:text-sm",
                      performance.days180 >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400",
                    )}
                  >
                    {performance.days180 >= 0 ? "+" : ""}
                    {performance.days180.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Subtle Divider Line */}
            <div className="my-3.5 border-t border-gray-80 dark:border-white/10" />

            {/* Bottom Row: Price & 24h Pill on Left, 2x2 Stats Grid on Right */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              {/* Left Column: Price & 24h Change Pill */}
              <div>
                <p
                  className={cn(
                    "text-2xl font-bold tabular-nums sm:text-3xl transition-colors duration-200",
                    realtime.direction === "up"
                      ? "text-emerald-500"
                      : realtime.direction === "down"
                        ? "text-rose-500"
                        : isPositive
                          ? "text-emerald-500 dark:text-emerald-400"
                          : "text-rose-500",
                  )}
                >
                  {formatUsd(currentPrice)}
                </p>
                <div className="mt-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                      isPositive
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                    )}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {isPositive ? "+" : ""}
                    {changePercent.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Right Column: 2x2 Stats Grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-left sm:gap-x-12 sm:gap-y-2.5">
                <div>
                  <p className="text-[11px] text-gray-20 dark:text-gray-400">24h High</p>
                  <p className="mt-0.5 text-xs font-semibold tabular-nums text-cryptoNight sm:text-sm dark:text-white">
                    {formatUsd(high24h)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-20 dark:text-gray-400">
                    24h Vol ({displayStockSymbol})
                  </p>
                  <p className="mt-0.5 text-xs font-semibold tabular-nums text-cryptoNight sm:text-sm dark:text-white">
                    {formatCompactVolume(vol24h)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-20 dark:text-gray-400">24h Low</p>
                  <p className="mt-0.5 text-xs font-semibold tabular-nums text-cryptoNight sm:text-sm dark:text-white">
                    {formatUsd(low24h)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-20 dark:text-gray-400">24h Turnover ($)</p>
                  <p className="mt-0.5 text-xs font-semibold tabular-nums text-cryptoNight sm:text-sm dark:text-white">
                    {formatCompactTurnover(turnover24h)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Timeframe Bar & Chart Controls */}
          <section className="relative rounded-2xl border border-gray-80 bg-white/80 p-2 sm:p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-secondary-50/50 dark:shadow-none">
            <div className="flex items-center justify-between gap-1 text-xs">
              <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
                <div
                  ref={timeframeScrollRef}
                  className="flex min-w-0 items-center gap-1 overflow-x-auto no-scrollbar sm:gap-1.5"
                >
                  {visibleTimeframes.map((tf) => {
                    const isActive =
                      tf === "Time"
                        ? chartType === "line"
                        : chartType === "candlestick" && activeInterval === tf;

                    return (
                      <button
                        key={tf}
                        ref={isActive ? activeTimeframeRef : undefined}
                        type="button"
                        onClick={() => {
                          if (tf === "Time") {
                            setChartType("line");
                          } else {
                            setChartType("candlestick");
                            setActiveInterval(tf);
                          }
                        }}
                        className={cn(
                          "relative px-2 py-1 text-[11px] sm:px-2.5 sm:py-1.5 sm:text-xs font-semibold transition rounded-md shrink-0 cursor-pointer touch-manipulation select-none",
                          isActive
                            ? "bg-primary-70/25 text-primary-70 shadow-[inset_0_0_0_1px_rgba(193,92,165,0.20)] font-bold"
                            : "text-gray-20 hover:text-cryptoNight hover:bg-gray-90/60 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5",
                        )}
                      >
                        {tf}
                      </button>
                    );
                  })}
                </div>

                {/* More dropdown button */}
                <button
                  ref={moreButtonRef}
                  type="button"
                  onClick={() => setIsMoreOpen((v) => !v)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 text-[11px] sm:px-2.5 sm:py-1.5 sm:text-xs font-semibold transition rounded-md shrink-0 cursor-pointer touch-manipulation select-none",
                    isMoreOpen
                      ? "bg-gray-90 text-cryptoNight dark:bg-white/10 dark:text-white"
                      : "text-gray-20 hover:text-cryptoNight hover:bg-gray-90/60 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5",
                  )}
                >
                  <span>More</span>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform duration-200",
                      isMoreOpen && "rotate-180",
                    )}
                  />
                </button>
              </div>

              {/* Chart Mode Toggle on Far Right */}
              <button
                type="button"
                onClick={() =>
                  setChartType((prev) =>
                    prev === "candlestick" ? "line" : "candlestick",
                  )
                }
                title="Toggle Candlestick / Line"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-70/25 text-primary-70 shadow-[inset_0_0_0_1px_rgba(193,92,165,0.20)] hover:bg-primary-70/35 hover:text-primary-60 cursor-pointer transition active:scale-95"
              >
                {chartType === "candlestick" ? (
                  <CandlestickChart className="h-4 w-4" />
                ) : (
                  <LineChart className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* More Timeframes Dropdown Menu */}
            {isMoreOpen ? (
              <>
                {/* Mobile backdrop */}
                <div
                  className="fixed inset-0 z-40 sm:hidden"
                  onClick={() => setIsMoreOpen(false)}
                  onTouchStart={() => setIsMoreOpen(false)}
                  aria-hidden="true"
                />

                <div
                  ref={moreDropdownRef}
                  className="absolute inset-x-2 top-11 z-50 rounded-2xl border border-gray-80 bg-white/95 p-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150 sm:inset-x-auto sm:right-2 sm:top-12 sm:w-80 dark:border-white/10 dark:bg-secondary-60/95 dark:shadow-2xl"
                >
                  {/* Pinned Section */}
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase text-gray-20 dark:text-gray-400">
                      Pinned
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                    {PINNED_TIMEFRAMES.map((item) => {
                      const isActive =
                        item === "Time"
                          ? chartType === "line"
                          : chartType === "candlestick" && activeInterval === item;

                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            if (item === "Time") {
                              setChartType("line");
                            } else {
                              setActiveInterval(item);
                              setChartType("candlestick");
                            }
                            setIsMoreOpen(false);
                          }}
                          className={cn(
                            "flex h-8.5 items-center justify-center rounded-xl text-xs font-semibold transition cursor-pointer select-none active:scale-95 touch-manipulation",
                            isActive
                              ? "border border-primary-60/40 bg-primary-70/20 text-primary-60 shadow-[0_0_12px_rgba(193,92,165,0.25)] font-bold"
                              : "border border-gray-80 bg-gray-90/60 text-gray-20 hover:border-gray-70 hover:bg-gray-80 hover:text-cryptoNight dark:border-white/5 dark:bg-white/5 dark:text-gray-300 dark:hover:border-white/10 dark:hover:bg-white/10 dark:hover:text-white",
                          )}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>

                  {/* Divider */}
                  <div className="my-2.5 border-t border-gray-80 dark:border-white/10" />

                  {/* Available Section */}
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase text-gray-20 dark:text-gray-400">
                      Available Intervals
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                    {AVAILABLE_TIMEFRAMES.map((item) => {
                      const isActive =
                        chartType === "candlestick" && activeInterval === item;

                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            setActiveInterval(item);
                            setChartType("candlestick");
                            setIsMoreOpen(false);
                          }}
                          className={cn(
                            "flex h-8.5 items-center justify-center rounded-xl text-xs font-semibold transition cursor-pointer select-none active:scale-95 touch-manipulation",
                            isActive
                              ? "border border-primary-60/40 bg-primary-70/20 text-primary-60 shadow-[0_0_12px_rgba(193,92,165,0.25)] font-bold"
                              : "border border-gray-80 bg-gray-90/60 text-gray-20 hover:border-gray-70 hover:bg-gray-80 hover:text-cryptoNight dark:border-white/5 dark:bg-white/5 dark:text-gray-300 dark:hover:border-white/10 dark:hover:bg-white/10 dark:hover:text-white",
                          )}
                        >
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}

            {/* 5. OHLC & MA Readout */}
            <div className="mt-3 border-t border-gray-80/60 pt-2 dark:border-white/5">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[10px] text-gray-20 sm:text-[11px] dark:text-gray-400">
                <span>{hoveredData?.timeStr || "Loading..."}</span>
                {hoveredData ? (
                  <div className="flex items-center gap-2 tabular-nums">
                    <span>
                      O <span className="text-cryptoNight dark:text-white">{hoveredData.open.toFixed(2)}</span>
                    </span>
                    <span>
                      H <span className="text-emerald-500 dark:text-emerald-400">{hoveredData.high.toFixed(2)}</span>
                    </span>
                    <span>
                      L <span className="text-rose-500 dark:text-rose-400">{hoveredData.low.toFixed(2)}</span>
                    </span>
                    <span>
                      C <span className={hoveredData.close >= hoveredData.open ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400"}>
                        {hoveredData.close.toFixed(2)}
                      </span>
                    </span>
                  </div>
                ) : null}
              </div>

              {activeIndicators.has("MA") && hoveredData ? (
                <div className="mt-1 flex items-center gap-3 text-[10px] tabular-nums">
                  {hoveredData.ma5 !== undefined ? (
                    <span className="text-amber-500 font-medium dark:text-amber-400">
                      MA(5): {hoveredData.ma5.toFixed(2)}
                    </span>
                  ) : null}
                  {hoveredData.ma10 !== undefined ? (
                    <span className="text-purple-600 font-medium dark:text-purple-400">
                      MA(10): {hoveredData.ma10.toFixed(2)}
                    </span>
                  ) : null}
                  {hoveredData.ma20 !== undefined ? (
                    <span className="text-cyan-600 font-medium dark:text-cyan-400">
                      MA(20): {hoveredData.ma20.toFixed(2)}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* 6. Trading Chart Canvas */}
            <div className="mt-2 h-[340px] w-full max-w-full overflow-hidden sm:h-[420px] lg:h-[480px]">
              {isCandlesLoading && candles.length === 0 ? (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-60 border-t-transparent" />
                </div>
              ) : (
                <StockTradingChart
                  candles={candles}
                  chartType={chartType}
                  indicators={activeIndicators}
                  avgBuyPrice={holding?.avgBuyPrice}
                  avgSellPrice={avgSellPrice > 0 ? avgSellPrice : undefined}
                  onHoverDataChange={handleHoverDataChange}
                  liveTick={realtime.lastTick}
                  className="h-full"
                />
              )}
            </div>

            {/* Volume Status bar */}
            {activeIndicators.has("VOL") && hoveredData ? (
              <div className="mt-1 flex items-center gap-3 border-t border-gray-80/60 pt-1.5 text-[10px] text-gray-20 tabular-nums dark:border-white/5 dark:text-gray-400">
                <span>VOL: {formatCompactVolume(hoveredData.volume)}</span>
                {hoveredData.volMa5 !== undefined ? (
                  <span className="text-amber-500 font-medium dark:text-amber-400">
                    MA(5): {formatCompactVolume(hoveredData.volMa5)}
                  </span>
                ) : null}
                {hoveredData.volMa10 !== undefined ? (
                  <span className="text-purple-600 font-medium dark:text-purple-400">
                    MA(10): {formatCompactVolume(hoveredData.volMa10)}
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* 7. Indicator Selector Pills */}
            <div className="mt-3 flex items-center justify-start sm:justify-between gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar border-t border-gray-80/60 pt-2 text-[10px] sm:text-[11px] dark:border-white/5">
              <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                {(["MA", "EMA", "BOLL", "SAR"] as IndicatorType[]).map((ind) => (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => toggleIndicator(ind)}
                    className={cn(
                      "rounded px-1.5 py-0.5 font-semibold transition sm:px-2 cursor-pointer",
                      activeIndicators.has(ind)
                        ? "bg-primary-70/25 text-primary-70 shadow-[inset_0_0_0_1px_rgba(193,92,165,0.20)]"
                        : "text-gray-20 hover:text-cryptoNight hover:bg-gray-90/60 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5",
                    )}
                  >
                    {ind}
                  </button>
                ))}
              </div>

              <div className="h-3.5 w-px shrink-0 bg-gray-80 dark:bg-white/10" />

              <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                {(["VOL", "MACD", "RSI", "KDJ"] as IndicatorType[]).map((ind) => (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => toggleIndicator(ind)}
                    className={cn(
                      "rounded px-1.5 py-0.5 font-semibold transition sm:px-2 cursor-pointer",
                      activeIndicators.has(ind)
                        ? "bg-primary-70/25 text-primary-70 shadow-[inset_0_0_0_1px_rgba(193,92,165,0.20)]"
                        : "text-gray-20 hover:text-cryptoNight hover:bg-gray-90/60 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5",
                    )}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 8. 5-Column Historical Performance Table (Mobile only; desktop renders in top summary card) */}
          <section className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar rounded-2xl border border-gray-80 bg-white/80 p-2 sm:p-3 text-center shadow-sm backdrop-blur dark:border-white/10 dark:bg-secondary-50/70 dark:shadow-none lg:hidden">
            <div className="min-w-[50px] flex-1">
              <p className="text-[9px] text-gray-20 sm:text-xs dark:text-gray-40">Today</p>
              <p
                className={cn(
                  "mt-0.5 text-[10px] min-[360px]:text-[11px] font-bold tabular-nums sm:mt-1 sm:text-sm",
                  performance.today >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400",
                )}
              >
                {performance.today >= 0 ? "+" : ""}
                {performance.today.toFixed(2)}%
              </p>
            </div>
            <div className="min-w-[50px] flex-1">
              <p className="text-[9px] text-gray-20 sm:text-xs dark:text-gray-40">7 Days</p>
              <p
                className={cn(
                  "mt-0.5 text-[10px] min-[360px]:text-[11px] font-bold tabular-nums sm:mt-1 sm:text-sm",
                  performance.days7 >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400",
                )}
              >
                {performance.days7 >= 0 ? "+" : ""}
                {performance.days7.toFixed(2)}%
              </p>
            </div>
            <div className="min-w-[50px] flex-1">
              <p className="text-[9px] text-gray-20 sm:text-xs dark:text-gray-40">30 Days</p>
              <p
                className={cn(
                  "mt-0.5 text-[10px] min-[360px]:text-[11px] font-bold tabular-nums sm:mt-1 sm:text-sm",
                  performance.days30 >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400",
                )}
              >
                {performance.days30 >= 0 ? "+" : ""}
                {performance.days30.toFixed(2)}%
              </p>
            </div>
            <div className="min-w-[50px] flex-1">
              <p className="text-[9px] text-gray-20 sm:text-xs dark:text-gray-40">90 Days</p>
              <p
                className={cn(
                  "mt-0.5 text-[10px] min-[360px]:text-[11px] font-bold tabular-nums sm:mt-1 sm:text-sm",
                  performance.days90 >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400",
                )}
              >
                {performance.days90 >= 0 ? "+" : ""}
                {performance.days90.toFixed(2)}%
              </p>
            </div>
            <div className="min-w-[50px] flex-1">
              <p className="text-[9px] text-gray-20 sm:text-xs dark:text-gray-40">180 Days</p>
              <p
                className={cn(
                  "mt-0.5 text-[10px] min-[360px]:text-[11px] font-bold tabular-nums sm:mt-1 sm:text-sm",
                  performance.days180 >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-rose-500 dark:text-rose-400",
                )}
              >
                {performance.days180 >= 0 ? "+" : ""}
                {performance.days180.toFixed(2)}%
              </p>
            </div>
          </section>

          {/* 9 & 10. Position & Activity Grid (side-by-side on lg, stacked on mobile) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 9. My Position Card */}
            <section className="rounded-2xl border border-gray-80 bg-white/80 p-4 sm:p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-secondary-50/70 dark:shadow-none flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-cryptoNight dark:text-white">My Position</h2>
                  {holding ? (
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                        holding.unrealizedPnL >= 0
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                      )}
                    >
                      {holding.unrealizedPnL >= 0 ? "+" : ""}
                      {holding.unrealizedPnLPercentage.toFixed(2)}%
                    </span>
                  ) : null}
                </div>

                {!holding ? (
                  <div className="my-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-gray-80 bg-gray-90/60 dark:border-white/10 dark:bg-white/5">
                      <WalletCards className="h-6 w-6 text-gray-400" />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-cryptoNight dark:text-white">
                      No Active Position
                    </h3>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-gray-20 dark:text-gray-400">
                      You do not own any {displayStockSymbol} shares yet. Start
                      investing with fractional shares from just $1.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-y-4 border-t border-gray-80/60 pt-4 text-xs dark:border-white/5">
                    <div>
                      <p className="text-gray-20 dark:text-gray-400">Shares Owned</p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-cryptoNight dark:text-white">
                        {holding.shares.toFixed(4)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-20 dark:text-gray-400">Total Value</p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-cryptoNight dark:text-white">
                        {formatUsd(holding.currentValue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-20 dark:text-gray-400">Average Cost</p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-cryptoNight dark:text-white">
                        {formatUsd(holding.avgBuyPrice)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-20 dark:text-gray-400">Total Return</p>
                      <p
                        className={cn(
                          "mt-1 text-sm font-bold tabular-nums",
                          holding.unrealizedPnL >= 0
                            ? "text-emerald-500 dark:text-emerald-400"
                            : "text-rose-500 dark:text-rose-400",
                        )}
                      >
                        {holding.unrealizedPnL >= 0 ? "+" : ""}
                        {formatUsd(holding.unrealizedPnL)} (
                        {holding.unrealizedPnL >= 0 ? "+" : ""}
                        {holding.unrealizedPnLPercentage.toFixed(2)}%)
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-20 dark:text-gray-400">Average Sell</p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-amber-500 dark:text-amber-400">
                        {avgSellPrice > 0 ? formatUsd(avgSellPrice) : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-20 dark:text-gray-400">Realized Status</p>
                      <p className="mt-1 text-sm font-bold text-cryptoNight dark:text-white">
                        {sellTransactions.length > 0 ? "Settled Exit" : "Open Position"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 10. Recent Activity Card */}
            <section className="rounded-2xl border border-gray-80 bg-white/80 p-4 sm:p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-secondary-50/70 dark:shadow-none flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-cryptoNight dark:text-white">Recent Activity</h2>
                  {stockActivities.length > 5 ? (
                    <Link
                      href={`/transactions?stock=${encodeURIComponent(underlyingTicker)}`}
                      className="cursor-pointer text-xs font-semibold text-primary-60 transition hover:text-primary-50 dark:text-primary-80 dark:hover:text-primary-70"
                    >
                      See more
                    </Link>
                  ) : stockActivities.length > 0 ? (
                    <span className="text-xs text-gray-20 dark:text-gray-400">
                      {stockActivities.length} of {stockActivities.length}
                    </span>
                  ) : null}
                </div>

                {isStockActivitiesLoading ? (
                  <div className="mt-4 space-y-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-14 animate-pulse rounded-xl bg-gray-90/80 dark:bg-white/5"
                      />
                    ))}
                  </div>
                ) : stockActivities.length === 0 ? (
                  <div className="my-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-gray-80 bg-gray-90/60 dark:border-white/10 dark:bg-white/5">
                      <Clock className="h-6 w-6 text-gray-400" />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-cryptoNight dark:text-white">
                      No Past Transactions
                    </h3>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-gray-20 dark:text-gray-400">
                      Your completed buy and sell orders for {displayStockSymbol} will
                      appear here.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mt-3 divide-y divide-gray-80/60 dark:divide-white/5">
                      {stockActivities.slice(0, 5).map((transaction) => {
                        const isSale = transaction.type === "SELL";
                        const dateStr = new Date(transaction.createdAt).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" },
                        );
                        const shares = getStockTransactionShares(transaction) || 0;
                        const fiatAmount =
                          getStockTransactionFiatAmount(transaction) ||
                          Number(transaction.amount || 0);

                        return (
                          <div
                            key={transaction.id}
                            onClick={() => router.push(`/transactions/${transaction.id}`)}
                            className="flex cursor-pointer items-center justify-between py-3 transition hover:opacity-80"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "flex h-9 w-9 items-center justify-center rounded-xl border",
                                  isSale
                                    ? "border-purple-300 bg-purple-100 text-purple-700 dark:border-purple-800/40 dark:bg-purple-950/40 dark:text-purple-300"
                                    : "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300",
                                )}
                              >
                                {isSale ? (
                                  <TrendingDown className="h-4 w-4" />
                                ) : (
                                  <TrendingUp className="h-4 w-4" />
                                )}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-cryptoNight sm:text-sm dark:text-white">
                                  {isSale ? "Sell" : "Buy"} {displayStockSymbol}
                                </p>
                                <p className="text-[11px] text-gray-20 dark:text-gray-400">
                                  {dateStr} • {settlementChain.toLowerCase()}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <p
                                className={cn(
                                  "text-xs font-bold tabular-nums sm:text-sm",
                                  isSale ? "text-purple-600 dark:text-purple-300" : "text-emerald-600 dark:text-emerald-400",
                                )}
                              >
                                {isSale ? "-" : "+"}
                                {shares > 0 ? shares.toFixed(6) : "0.00"} {displayStockSymbol}
                              </p>
                              <p className="text-[11px] text-gray-20 tabular-nums dark:text-gray-400">
                                {isSale ? "+" : "-"}${fiatAmount.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {stockActivities.length > 5 && (
                      <div className="mt-3 border-t border-gray-80/60 pt-3 dark:border-white/5">
                        <Link
                          href={`/transactions?stock=${encodeURIComponent(underlyingTicker)}`}
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-80 bg-gray-90/40 py-2.5 text-xs font-semibold text-cryptoNight transition hover:bg-gray-80/60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                        >
                          <span>See more ({stockActivities.length - 5} more)</span>
                          <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                        </Link>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      ) : (
        /* Company, Token Info, and Data tabs */
        <StockResearchContent
          tab={activeTab}
          title={displayStockSymbol}
          ticker={underlyingTicker}
          stockName={stock?.name || name}
          turnover24h={turnover24h}
          description={
            STOCK_DESCRIPTIONS[underlyingTicker] ||
            `${name} is available as a tokenized stock on Kellon.`
          }
          company={COMPANY_PROFILES[underlyingTicker]}
          finnhubMarketData={finnhubMarketData}
          companyNews={companyNewsData?.articles || []}
          newsFacts={companyNewsFactsData?.facts || {}}
          wikidataProfile={companyProfileData?.profile || undefined}
          isCompanyNewsLoading={isCompanyNewsLoading}
          isCompanyNewsError={isCompanyNewsError}
          provider={stock?.provider || "base_b20"}
          settlementChain={settlementChain}
          price={currentPrice}
          chartHigh={high24h}
          chartLow={low24h}
          dexPool={dexScreenerData?.pair || null}
          isDexScreenerLoading={isDexScreenerLoading}
          hasDexPoolMetadata={Boolean(dexTokenAddress || dexPairAddress)}
          rwaCategory={stock?.rwaCategory}
          isRwa={isRwa}
          stockOptions={stockOptions}
        />
      )}
        </div>

        {/* Right Column: Desktop Binance-style Sidebar (Other Stocks + Top Movers) */}
        <aside className="hidden min-[1200px]:flex min-[1200px]:flex-col min-[1200px]:gap-4 min-[1200px]:sticky min-[1200px]:top-20">
          <StockDesktopSidebar
            stocks={stocks}
            currentSymbol={underlyingTicker}
            watchlist={watchlist}
            onToggleWatchlist={handleToggleWatchlist}
            currentLivePrice={currentPrice}
          />
        </aside>
      </div>

      {/* 11. Sticky Bottom Action Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none transition-[left] duration-200 bg-gradient-to-t from-background/90 via-background/40 to-transparent pb-4 pt-4 sm:pb-5 min-[1024px]:left-56 min-[1024px]:left-[var(--desktop-sidebar-width)]">
        <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3 px-3 sm:px-4 md:px-6 lg:max-w-none lg:px-6 xl:px-8 pointer-events-auto">
          {canSell ? (
            <>
              <Button
                type="button"
                className="group relative overflow-hidden h-12 flex-1 rounded-xl bg-red-500 text-sm sm:text-base font-bold text-white shadow-lg shadow-red-500/25 hover:bg-red-600 hover:shadow-xl active:scale-[0.98] transition cursor-pointer"
                onClick={() => setStockAction("sell")}
              >
                <span className="relative z-10 flex items-center justify-center gap-1.5 sm:gap-2 truncate">
                  Sell{stockActionSymbol ? ` ${stockActionSymbol}` : ""}
                </span>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
              </Button>
              <Button
                type="button"
                variant="flow"
                className="h-12 flex-1 text-sm sm:text-base shadow-primary-60/30 cursor-pointer"
                onClick={() => setStockAction("buy")}
              >
                <span className="relative z-10 flex items-center justify-center gap-1.5 sm:gap-2 truncate">
                  Buy{stockActionSymbol ? ` ${stockActionSymbol}` : ""}
                </span>
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="flow"
              className="h-12 w-full text-sm sm:text-base shadow-primary-60/30 cursor-pointer"
              onClick={() => setStockAction("buy")}
            >
              <span className="relative z-10 flex items-center justify-center gap-2 truncate">
                Buy{stockActionSymbol ? ` ${stockActionSymbol}` : ""}
              </span>
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
            </Button>
          )}
        </div>
      </footer>

      {/* Stock Action Dialog (Buy & Sell) */}
      <StockActionDialog
        action={stockAction || "buy"}
        stock={stock || null}
        holding={holding}
        stockOptions={stockOptions}
        profile={profile}
        open={Boolean(stockAction)}
        livePrice={currentPrice}
        onOpenChange={(open) => {
          if (!open) setStockAction(null);
        }}
        onComplete={async () => {
          await Promise.all([refetch(), refetchPortfolio(), refetchTransactions()]);
        }}
        onViewPosition={() => setActiveTab("Charts")}
      />
    </main>
  );
}

function NewsRelativeTime({ value }: { value: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  const date = new Date(value);
  const fallback = Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

  if (now === null) {
    return <span suppressHydrationWarning>{fallback}</span>;
  }

  return <span suppressHydrationWarning>{formatNewsTimestamp(value, now)}</span>;
}

function CompanyDescription({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setIsExpanded(false);
  }, [text]);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const checkOverflow = () => {
      if (!isExpanded) {
        setCanExpand(el.scrollHeight > el.clientHeight + 1);
      }
    };

    checkOverflow();

    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(el);

    return () => resizeObserver.disconnect();
  }, [text, isExpanded]);

  return (
    <div className="mt-4 max-w-3xl">
      <p
        ref={textRef}
        className={cn(
          "text-sm leading-6 text-gray-10 dark:text-gray-300 transition-all",
          !isExpanded && "line-clamp-3",
        )}
      >
        {text}
      </p>
      {canExpand ? (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-40 hover:underline cursor-pointer"
        >
          {isExpanded ? "Show Less" : "Show More"}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-200",
              isExpanded && "rotate-180",
            )}
          />
        </button>
      ) : null}
    </div>
  );
}

function StockResearchContent({
  tab,
  title,
  ticker,
  stockName,
  turnover24h,
  description,
  company,
  finnhubMarketData,
  companyNews,
  newsFacts,
  wikidataProfile,
  isCompanyNewsLoading,
  isCompanyNewsError,
  provider,
  settlementChain,
  price,
  chartHigh,
  chartLow,
  dexPool,
  isDexScreenerLoading,
  hasDexPoolMetadata,
  rwaCategory,
  isRwa,
  stockOptions = [],
}: {
  tab: Exclude<StockPageTab, "Charts">;
  title: string;
  ticker?: string;
  stockName?: string;
  turnover24h?: number;
  description: string;
  company?: CompanyProfile;
  finnhubMarketData?: FinnhubMarketData;
  companyNews: CompanyNewsArticle[];
  newsFacts: NewsCompanyFacts;
  wikidataProfile?: WikidataCompanyProfile;
  isCompanyNewsLoading: boolean;
  isCompanyNewsError: boolean;
  provider: string;
  settlementChain: string;
  price: number;
  chartHigh: number;
  chartLow: number;
  dexPool: DexScreenerPool | null;
  isDexScreenerLoading: boolean;
  hasDexPoolMetadata: boolean;
  rwaCategory?: string;
  isRwa?: boolean;
  stockOptions?: StockListing[];
}) {
  const officialProfile = finnhubMarketData?.profile;
  const metric = (key: string) => finnhubMarketData?.metrics?.[key];

  if (tab === "Company") {
    const fallback = (ticker && COMPANY_FINANCIAL_FALLBACKS[ticker]) || {};

    // 1. Market Cap
    let marketCapValue = fallback.marketCap || "—";
    if (officialProfile?.marketCap && officialProfile.marketCap > 0) {
      const mc = officialProfile.marketCap;
      if (mc >= 1_000_000) {
        marketCapValue = `$${(mc / 1_000_000).toFixed(2)} Trillion`;
      } else if (mc >= 1_000) {
        marketCapValue = `$${(mc / 1_000).toFixed(2)} Billion`;
      } else {
        marketCapValue = `$${mc.toFixed(2)} Million`;
      }
    }

    // 2. P/E Ratio
    const pe = metric("peTTM") ?? metric("peNormalizedAnnual") ?? metric("peExclExtraTTM");
    const peRatioValue =
      pe !== undefined && Number(pe) > 0 ? `${Number(pe).toFixed(1)}x` : fallback.peRatio || "—";

    // 3. Dividend Yield
    const dy = metric("dividendYieldIndicatedAnnual") ?? metric("dividendYield5Y");
    const dividendYieldValue =
      dy !== undefined && Number(dy) >= 0 ? `${Number(dy).toFixed(2)}%` : fallback.dividendYield || "—";

    // 4. 24h Volume
    const volume24hValue = turnover24h ? formatCompactTurnover(turnover24h) : fallback.volume24h || "$7.29M";

    // 5. Avg Volume
    const avgVol = metric("10DayAverageTradingVolume") ?? metric("3MonthAverageTradingVolume");
    const avgVolumeValue = avgVol
      ? `${formatCompactVolume(Number(avgVol) >= 1000 ? Number(avgVol) : Number(avgVol) * 1_000_000)} shares`
      : fallback.avgVolume || "42.8M shares";

    // 6. 52-Week Range
    const w52Low = metric("52WeekLow");
    const w52High = metric("52WeekHigh");
    const range52wValue =
      w52Low && w52High
        ? `$${Number(w52Low).toFixed(2)} - $${Number(w52High).toFixed(2)}`
        : fallback.range52w || "—";

    // Financial Summary
    const revTTM = metric("revenueTTM");
    const revenueTTMValue =
      revTTM && Number(revTTM) > 0 ? `$${(Number(revTTM) / 1000).toFixed(1)}B` : fallback.revenueTTM || "—";

    const revGrowth = metric("revenueGrowthTTMYoy") ?? metric("revenueGrowth3Y");
    const revenueGrowthValue =
      revGrowth !== undefined
        ? `${Number(revGrowth) >= 0 ? "+" : ""}${Number(revGrowth).toFixed(2)}%`
        : fallback.revenueGrowth || "—";

    const gm = metric("grossMarginTTM") ?? metric("grossMarginAnnual");
    const grossMarginValue =
      gm !== undefined ? `${Number(gm).toFixed(2)}%` : fallback.grossMargin || "—";

    const om = metric("operatingMarginTTM");
    const operatingMarginValue =
      om !== undefined ? `${Number(om).toFixed(2)}%` : fallback.operatingMargin || "—";

    const npm = metric("netProfitMarginTTM");
    const netProfitMarginValue =
      npm !== undefined ? `${Number(npm).toFixed(2)}%` : fallback.netProfitMargin || "—";

    const eps = metric("epsTTM") ?? metric("epsNormalizedAnnual");
    const epsValue =
      eps !== undefined ? `$${Number(eps).toFixed(2)}` : fallback.eps || "—";

    const roe = metric("roeTTM") ?? metric("roaeTTM");
    const roeValue =
      roe !== undefined ? `${Number(roe).toFixed(2)}%` : fallback.roe || "—";

    const de = metric("totalDebt/totalEquityAnnual") ?? metric("totalDebt/totalEquityQuarter");
    const debtEquityValue =
      de !== undefined ? `${Number(de).toFixed(2)}` : fallback.debtEquity || "—";

    const pb = metric("pbAnnual") ?? metric("priceToBookTTM");
    const priceBookValue =
      pb !== undefined ? `${Number(pb).toFixed(2)}x` : fallback.priceBook || "—";

    const beta = metric("beta");
    const betaValue =
      beta !== undefined ? `${Number(beta).toFixed(2)}` : fallback.beta || "—";

    const categoryLabel = resolveStockCategory({
      ticker,
      company,
      officialProfile,
      wikidataProfile,
      rwaCategory,
    });
    const resolvedDescription =
      company?.description ||
      (ticker && STOCK_DESCRIPTIONS[ticker]) ||
      wikidataProfile?.description ||
      description;

    return (
      <div className="space-y-4 w-full max-w-full">
        {/* 1. Company Overview & Facts */}
        <section className="rounded-2xl border border-gray-80 bg-white/80 p-3.5 sm:p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-secondary-50/70 dark:shadow-none">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-1 text-lg sm:text-xl font-bold text-cryptoNight dark:text-white break-words">
              {company?.name ||
                wikidataProfile?.name ||
                officialProfile?.name ||
                title}
            </h2>
            <span className="shrink-0 rounded-full border border-primary-60/40 bg-primary-70/10 px-2.5 py-1 text-xs font-semibold text-primary-40">
              {categoryLabel}
            </span>
            {company?.industry && company.industry.toLowerCase() !== categoryLabel.toLowerCase() ? (
              <span className="shrink-0 rounded-full border border-gray-80 bg-gray-90/60 px-2.5 py-1 text-xs font-semibold text-gray-20 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
                {company.industry}
              </span>
            ) : null}
          </div>

          <CompanyDescription text={resolvedDescription} />

          {company?.website ||
          wikidataProfile?.website ||
          officialProfile?.website ? (
            <a
              href={
                company?.website ||
                wikidataProfile?.website ||
                officialProfile?.website
              }
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary-60/40 bg-primary-70/10 px-4 text-xs sm:text-sm font-semibold text-primary-40 transition hover:bg-primary-70/20 active:scale-[0.99] text-center"
            >
              <Globe className="h-4 w-4 shrink-0" />
              <span className="truncate">Visit Official Website</span>
              <ExternalLink className="h-4 w-4 shrink-0" />
            </a>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3">
            <MetricBox
              label="Chief executive"
              value={
                company?.ceo ||
                wikidataProfile?.ceo ||
                newsFacts.ceo?.value ||
                "Not available"
              }
            />
            <MetricBox
              label="Headquarters"
              value={
                company?.headquarters ||
                wikidataProfile?.headquarters ||
                newsFacts.headquarters?.value ||
                "Not available"
              }
            />
            <MetricBox
              label="Founded"
              value={
                company?.founded ||
                wikidataProfile?.founded ||
                newsFacts.founded?.value ||
                "Not available"
              }
            />
            <MetricBox
              label="Employees"
              value={
                company?.employees ||
                wikidataProfile?.employees ||
                newsFacts.employees?.value ||
                "Not available"
              }
            />
          </div>
        </section>

        {/* 2. Key Metrics Card */}
        <section className="rounded-2xl border border-gray-80 bg-white/80 p-3.5 sm:p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-secondary-50/70 dark:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-bold text-cryptoNight dark:text-white">Key Metrics</h2>
            <span className="shrink-0 rounded-full border border-primary-60/40 bg-primary-70/10 px-2.5 py-0.5 text-[11px] sm:text-xs font-semibold text-primary-40">
              Financial Overview
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
            <MetricBox label="Market Cap" value={marketCapValue} />
            <MetricBox label="P/E Ratio" value={peRatioValue} />
            <MetricBox label="Dividend Yield" value={dividendYieldValue} />
            <MetricBox label="24h Volume" value={volume24hValue} />
            <MetricBox label="Avg Volume" value={avgVolumeValue} />
            <MetricBox label="52-Week Range" value={range52wValue} />
          </div>
        </section>

        {/* 3. Financial Summary Card */}
        <section className="rounded-2xl border border-gray-80 bg-white/80 p-3.5 sm:p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-secondary-50/70 dark:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-bold text-cryptoNight dark:text-white">Financial Summary</h2>
            <span className="shrink-0 rounded-full border border-primary-60/40 bg-primary-70/10 px-2.5 py-0.5 text-[11px] sm:text-xs font-semibold text-primary-40">
              Fundamentals (TTM)
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
            <MetricBox label="Revenue (TTM)" value={revenueTTMValue} />
            <MetricBox label="Revenue Growth (YoY)" value={revenueGrowthValue} />
            <MetricBox label="Gross Margin" value={grossMarginValue} />
            <MetricBox label="Operating Margin" value={operatingMarginValue} />
            <MetricBox label="Net Profit Margin" value={netProfitMarginValue} />
            <MetricBox label="EPS (TTM)" value={epsValue} />
            <MetricBox label="Return on Equity (ROE)" value={roeValue} />
            <MetricBox label="Debt / Equity" value={debtEquityValue} />
            <MetricBox label="Price / Book (P/B)" value={priceBookValue} />
            <MetricBox label="Beta (Volatility)" value={betaValue} />
          </div>
        </section>
      </div>
    );
  }

  if (tab === "News") {
    return (
      <div className="space-y-4 w-full max-w-full">
        {/* Latest news */}
        <section className="rounded-2xl border border-gray-80 bg-white/80 p-3.5 sm:p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-secondary-50/70 dark:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-cryptoNight dark:text-white">Latest news</h2>
              <p className="mt-0.5 text-xs text-gray-20 dark:text-gray-400">
                Live market news and updates for {title}
              </p>
            </div>
          </div>

          {isCompanyNewsLoading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-90/60 dark:bg-white/5" />
              ))}
            </div>
          ) : isCompanyNewsError ? (
            <p className="mt-4 text-xs text-gray-20 dark:text-gray-400">
              News is temporarily unavailable.
            </p>
          ) : companyNews.length ? (
            <div className="mt-4 divide-y divide-gray-80 dark:divide-white/10">
              {companyNews.map((article) => (
                <a
                  key={article.url}
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start justify-between gap-4 py-3.5 transition hover:opacity-80"
                >
                  <CompanyNewsThumbnail src={article.imageUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-cryptoNight dark:text-white">
                      {article.title}
                    </p>
                    {article.publishedAt ? (
                      <p className="mt-1 text-xs text-gray-20 dark:text-gray-400">
                        <NewsRelativeTime value={article.publishedAt} />
                      </p>
                    ) : null}
                  </div>
                  <ExternalLink className="h-4 w-4 shrink-0 text-primary-40" />
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs text-gray-20 dark:text-gray-400">No news articles found.</p>
          )}
        </section>
      </div>
    );
  }

  if (tab === "Token Info") {
    const rawBase =
      company?.name ||
      stockName?.replace(/\s+(?:[bcx]stock)$/i, "").trim() ||
      ticker ||
      title ||
      "Asset";
    const underlyingAsset = isRwa
      ? `${rawBase}${ticker ? ` (${ticker})` : ""}`
      : /tokenized\s+stock/i.test(rawBase)
        ? `${rawBase}${ticker ? ` (${ticker})` : ""}`
        : `${rawBase.replace(/\s+stock$/i, "")} Tokenized Stock${ticker ? ` (${ticker})` : ""}`;

    const specIssuers = isRwa ? "B20" : "B20 · Ondo · xStock · bStock";
    const specTokenStandard = isRwa ? "ERC-20" : "ERC-20 · BEP-20 · SPL Token-2022";
    const specCustodian = isRwa
      ? "Segregated Trust Custody"
      : "InCore Bank AG · Apex Clearing · DriveWealth Qualified Custody";
    const specNetworks = isRwa ? "Base" : "Base, BNB Smart Chain, Solana";

    return (
      <div className="space-y-4 w-full max-w-full">
        {/* 1. Token Specifications */}
        <section className="rounded-2xl border border-gray-80 bg-white/80 p-3.5 sm:p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-secondary-50/70 dark:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-cryptoNight sm:text-lg dark:text-white">
              Token Specifications
            </h2>
          </div>

          <div className="mt-4 space-y-3 sm:space-y-4">
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <span className="text-xs text-gray-20 sm:text-sm dark:text-gray-400 shrink-0">
                Underlying Asset
              </span>
              <span className="max-w-[70%] text-right text-xs font-semibold text-cryptoNight sm:text-sm dark:text-white break-words min-w-0">
                {underlyingAsset}
              </span>
            </div>

            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <span className="text-xs text-gray-20 sm:text-sm dark:text-gray-400 shrink-0">
                Issuers
              </span>
              <span className="max-w-[70%] text-right text-xs font-semibold text-cryptoNight sm:text-sm dark:text-white break-words min-w-0">
                {specIssuers}
              </span>
            </div>

            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <span className="text-xs text-gray-20 sm:text-sm dark:text-gray-400 shrink-0">
                Token Standard
              </span>
              <span className="max-w-[70%] text-right text-xs font-semibold text-cryptoNight sm:text-sm dark:text-white break-words min-w-0">
                {specTokenStandard}
              </span>
            </div>

            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <span className="text-xs text-gray-20 sm:text-sm dark:text-gray-400 shrink-0">
                Custodian
              </span>
              <span className="max-w-[70%] text-right text-xs font-semibold leading-relaxed text-cryptoNight sm:text-sm dark:text-white break-words min-w-0">
                {specCustodian}
              </span>
            </div>

            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <span className="text-xs text-gray-20 sm:text-sm dark:text-gray-400 shrink-0">
                Networks
              </span>
              <span className="max-w-[70%] text-right text-xs font-semibold text-cryptoNight sm:text-sm dark:text-white break-words min-w-0">
                {specNetworks}
              </span>
            </div>

            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <span className="text-xs text-gray-20 sm:text-sm dark:text-gray-400 shrink-0">
                Settlement
              </span>
              <span className="text-right text-xs font-semibold text-primary-40 sm:text-sm shrink-0">
                On-Chain
              </span>
            </div>
          </div>
        </section>

        {/* 2. Tokenholder Protections & Rights */}
        <section className="rounded-2xl border border-gray-80 bg-white/80 p-3.5 sm:p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-secondary-50/70 dark:shadow-none">
          <h2 className="text-base font-bold text-cryptoNight sm:text-lg dark:text-white">
            Tokenholder Protections & Rights
          </h2>

          <div className="mt-5 space-y-4 sm:space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-500/10 text-pink-500 dark:bg-pink-500/15 dark:text-pink-400">
                <Scale className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-cryptoNight dark:text-white">
                  100% Economic Exposure
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-20 dark:text-gray-400">
                  Token holders receive identical financial exposure to price movements and corporate actions of the underlying public shares.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-400">
                <Banknote className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-cryptoNight dark:text-white">
                  Dividend Pass-Through
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-20 dark:text-gray-400">
                  Cash dividends declared by the issuer are converted and distributed directly to the token holder&apos;s wallet in USDC upon settlement.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 dark:bg-amber-500/15 dark:text-amber-400">
                <Vote className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-cryptoNight dark:text-white">
                  Voting Rights Disclosure
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-20 dark:text-gray-400">
                  Tokens represent digital depository certificates. Voting rights are held by the qualified custodian in trust for underlying share pools.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-purple-500 dark:bg-purple-500/15 dark:text-purple-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-cryptoNight dark:text-white">
                  Bankruptcy-Remote Custody
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-20 dark:text-gray-400">
                  Underlying securities are held in segregated, bankruptcy-remote accounts protected from issuer or distributor insolvency.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Data tab
  const deployments = (
    stockOptions && stockOptions.length > 0
      ? stockOptions
      : [
          {
            symbol: `${ticker || title}c`,
            name: `${title} Tokenized Stock`,
            price: price,
            currency: "USD",
            provider: provider || "base_b20",
            settlementChain: settlementChain || "BASE",
            tokenAddress: dexPool?.tokenAddress,
          } as StockListing,
        ]
  ).map((opt) => {
    const chain =
      getStockSettlementChain(
        opt.provider,
        opt.settlementChain || opt.chain || opt.network,
      ) || "Base";
    const address =
      opt.tokenAddress ||
      opt.contractAddress ||
      opt.address ||
      (dexPool && chain.toLowerCase().includes("base")
        ? dexPool.tokenAddress
        : undefined);

    return {
      symbol: opt.symbol || `${ticker || title}c`,
      chain,
      standardAndProvider: getDeploymentStandardAndProvider(opt),
      address,
    };
  });

  const networksCount = new Set(deployments.map((d) => d.chain.toLowerCase())).size || 1;

  const rawMarketCap = officialProfile?.marketCap;
  let marketCapDisplay = "—";
  if (rawMarketCap && Number(rawMarketCap) > 0) {
    const cap = Number(rawMarketCap);
    if (cap >= 1_000_000) {
      marketCapDisplay = `$${(cap / 1_000_000).toFixed(2)} Trillion`;
    } else if (cap >= 1_000) {
      marketCapDisplay = `$${(cap / 1_000).toFixed(2)} Billion`;
    } else {
      marketCapDisplay = `$${cap.toFixed(2)}M`;
    }
  }

  const vol24hNumber = turnover24h || Number(metric("turnover24h")) || 0;
  const vol24hDisplay =
    vol24hNumber > 0 ? formatCompactTurnover(vol24hNumber) : "—";

  const avgVolNumber = Number(
    metric("10DayAverageTradingVolume") ||
      metric("3MonthAverageTradingVolume") ||
      0,
  );
  const avgVolDisplay =
    avgVolNumber > 0 ? `${avgVolNumber.toFixed(1)}M shares` : "—";

  const low52 = metric("52WeekLow");
  const high52 = metric("52WeekHigh");
  const range52Display =
    low52 && high52
      ? `$${Number(low52).toFixed(2)} - $${Number(high52).toFixed(2)}`
      : "—";

  const peRaw =
    metric("peNormalizedAnnual") ||
    metric("peTTM") ||
    metric("peBasicExclExtraTTM");
  const peDisplay =
    peRaw && Number(peRaw) > 0 ? `${Number(peRaw).toFixed(1)}x` : "—";

  const divYieldRaw =
    metric("dividendYieldIndicatedAnnual") || metric("dividendYield5Y");
  const divYieldDisplay =
    divYieldRaw && Number(divYieldRaw) > 0
      ? `${Number(divYieldRaw).toFixed(2)}%`
      : "—";

  const high24Display = chartHigh ? formatUsd(chartHigh) : "—";
  const low24Display = chartLow ? formatUsd(chartLow) : "—";

  const hasLiveDexActivity = Boolean(
    dexPool &&
      (Number(dexPool.volume24hUsd || 0) > 0 ||
        Number(dexPool.liquidityUsd || 0) > 0),
  );

  return (
    <div className="space-y-4 w-full max-w-full">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-cryptoNight dark:text-white">
            On-Chain RWA & Reserve Intelligence
          </h1>
          <p className="mt-0.5 text-xs text-gray-20 dark:text-gray-400">
            Verified contract deployments, DEX pool liquidity & trade flow for {ticker || title}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          LIVE
        </span>
      </div>

      {/* 1. 24h DEX On-Chain Flow */}
      <section className="rounded-2xl border border-gray-80 bg-white/80 p-3.5 sm:p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-secondary-50/70 dark:shadow-none">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-pink-500" />
          <h2 className="text-base font-bold text-cryptoNight sm:text-lg dark:text-white">
            24h DEX On-Chain Flow
          </h2>
        </div>

        {!hasLiveDexActivity && (
          <div className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 text-xs text-gray-300 dark:border-purple-500/15 dark:bg-purple-950/20">
            <Info className="h-4 w-4 shrink-0 text-purple-400 mt-0.5" />
            <p className="leading-relaxed">
              No public AMM swap transactions recorded in the last 24h, or primary execution settles via regulated RFQ / custodial minting.
            </p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="min-w-0 rounded-xl border border-gray-80 bg-gray-90/40 p-2.5 sm:p-3 text-center dark:border-white/5 dark:bg-white/[0.04]">
            <span className="block text-[10px] sm:text-[11px] font-semibold uppercase text-gray-20 dark:text-gray-400 truncate">
              DEX Pool Liquidity
            </span>
            <p className="mt-1.5 text-xs sm:text-sm font-bold text-cryptoNight dark:text-white">
              {dexPool?.liquidityUsd ? formatCompactTurnover(dexPool.liquidityUsd) : "—"}
            </p>
          </div>
          <div className="min-w-0 rounded-xl border border-gray-80 bg-gray-90/40 p-2.5 sm:p-3 text-center dark:border-white/5 dark:bg-white/[0.04]">
            <span className="block text-[10px] sm:text-[11px] font-semibold uppercase text-gray-20 dark:text-gray-400 truncate">
              24h DEX Volume
            </span>
            <p className="mt-1.5 text-xs sm:text-sm font-bold text-cryptoNight dark:text-white">
              {dexPool?.volume24hUsd ? formatCompactTurnover(dexPool.volume24hUsd) : "—"}
            </p>
          </div>
          <div className="min-w-0 rounded-xl border border-gray-80 bg-gray-90/40 p-2.5 sm:p-3 text-center dark:border-white/5 dark:bg-white/[0.04]">
            <span className="block text-[10px] sm:text-[11px] font-semibold uppercase text-gray-20 dark:text-gray-400 truncate">
              On-Chain FDV
            </span>
            <p className="mt-1.5 text-xs sm:text-sm font-bold text-cryptoNight dark:text-white">
              {dexPool?.fdv ? formatCompactTurnover(dexPool.fdv) : "—"}
            </p>
          </div>
        </div>
      </section>

      {/* 2. Verified Contract Deployments */}
      <section className="rounded-2xl border border-gray-80 bg-white/80 p-3.5 sm:p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-secondary-50/70 dark:shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-400" />
            <h2 className="text-base font-bold text-cryptoNight sm:text-lg dark:text-white">
              Verified Contract Deployments
            </h2>
          </div>
          <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            {networksCount} {networksCount === 1 ? "Network" : "Networks"}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {deployments.map((dep, idx) => (
            <div
              key={`${dep.symbol}-${dep.chain}-${idx}`}
              className="rounded-xl border border-gray-80 bg-gray-90/30 p-3 sm:p-3.5 dark:border-white/5 dark:bg-white/[0.03]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-cryptoNight dark:text-white">
                    {dep.symbol}
                  </span>
                  <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", getChainBadgeStyle(dep.chain))}>
                    {dep.chain}
                  </span>
                  <span className="text-xs text-gray-20 dark:text-gray-400">
                    {dep.standardAndProvider}
                  </span>
                </div>
                {dep.address && (
                  <div className="flex items-center gap-2">
                    <CopyAddressButton address={dep.address} />
                    <a
                      href={getExplorerUrl(dep.chain, dep.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-400 transition hover:bg-purple-500/20 active:scale-95"
                    >
                      <span>Explorer</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
              {dep.address ? (
                <p className="mt-1.5 font-mono text-xs text-gray-20 dark:text-gray-400 break-all">
                  {dep.address}
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-20 dark:text-gray-400">
                  On-chain deployment verified through qualified venue.
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 3. 100% Asset-Backed Guarantee */}
      <section className="rounded-2xl border border-gray-80 bg-white/80 p-3.5 sm:p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-secondary-50/70 dark:shadow-none">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-cryptoNight sm:text-lg dark:text-white">
              100% Asset-Backed Guarantee
            </h2>
            <p className="mt-0.5 text-xs text-gray-20 dark:text-gray-400">
              Every tokenized share corresponds to real underlying equity held in regulated custody
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3.5 sm:space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <Lock className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-bold text-cryptoNight dark:text-white">
                1:1 Regulated Custody
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-20 dark:text-gray-400">
                Underlying shares stored in bankruptcy-remote vaults at regulated clearing custodians.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <Scale className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-bold text-cryptoNight dark:text-white">
                Statutory Pass-Through
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-20 dark:text-gray-400">
                Full economic rights including corporate actions, stock splits, and proportional NAV tracking.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
              <Zap className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-bold text-cryptoNight dark:text-white">
                Instant Atomic Settlement
              </h3>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-20 dark:text-gray-400">
                Real-time on-chain clearing on Base, BNB Chain, and Solana with zero T+1 counterparty exposure.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Market & Valuation Metrics */}
      <section className="rounded-2xl border border-gray-80 bg-white/80 p-3.5 sm:p-5 shadow-sm backdrop-blur dark:border-white/10 dark:bg-secondary-50/70 dark:shadow-none">
        <h2 className="text-base font-bold text-cryptoNight sm:text-lg dark:text-white">
          Market & Valuation Metrics
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
          <MetricBox label="Market Cap" value={marketCapDisplay} />
          <MetricBox label="24h Volume" value={vol24hDisplay} />
          <MetricBox label="Avg Volume" value={avgVolDisplay} />
          <MetricBox label="52-Week Range" value={range52Display} />
          <MetricBox label="P/E Ratio" value={peDisplay} />
          <MetricBox label="Dividend Yield" value={divYieldDisplay} />
          <MetricBox label="24h High" value={high24Display} />
          <MetricBox label="24h Low" value={low24Display} />
        </div>
      </section>
    </div>
  );
}

function CopyAddressButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Contract address copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-lg border border-gray-80 bg-white/50 px-2 py-1 text-[11px] font-semibold text-cryptoNight transition hover:bg-gray-80/60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 cursor-pointer active:scale-95"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 text-gray-400" />
      )}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

function getExplorerUrl(chain: string, address: string): string {
  const c = chain.toLowerCase();
  if (c.includes("solana")) return `https://solscan.io/token/${address}`;
  if (c.includes("bnb") || c.includes("bsc") || c.includes("binance")) {
    return `https://bscscan.com/token/${address}`;
  }
  if (c.includes("base")) return `https://basescan.org/token/${address}`;
  if (c.includes("arbitrum")) return `https://arbiscan.io/token/${address}`;
  if (c.includes("polygon")) return `https://polygonscan.com/token/${address}`;
  return `https://etherscan.io/token/${address}`;
}

function getDeploymentStandardAndProvider(item: StockListing): string {
  const norm = (item.provider || "").toLowerCase();
  const chainNorm = (item.settlementChain || item.chain || "").toLowerCase();

  if (
    norm.includes("solana") ||
    norm.includes("xstock") ||
    chainNorm.includes("solana")
  ) {
    return "SPL Token-2022 · xStock";
  }
  if (
    norm.includes("pancake") ||
    norm.includes("bstock") ||
    chainNorm.includes("bnb") ||
    chainNorm.includes("bsc")
  ) {
    return "BEP-20 · bStock";
  }
  if (norm.includes("ondo")) {
    return "ERC-20 · Ondo";
  }
  if (norm.includes("b20") || chainNorm.includes("base")) {
    return "ERC-20 · B20";
  }
  return `ERC-20 · ${getStockProviderLabel(item.provider || "Base20")}`;
}

function getChainBadgeStyle(chain: string) {
  const c = chain.toLowerCase();
  if (c.includes("solana")) {
    return "border-purple-500/30 bg-purple-500/10 text-purple-400";
  }
  if (c.includes("bnb") || c.includes("bsc") || c.includes("binance")) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-400";
  }
  if (c.includes("base")) {
    return "border-blue-500/30 bg-blue-500/10 text-blue-400";
  }
  return "border-primary-60/30 bg-primary-70/10 text-primary-40";
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-80 bg-gray-90/40 p-2.5 sm:p-4 shadow-xs dark:border-white/5 dark:bg-white/[0.04] dark:shadow-none flex flex-col justify-between">
      <span className="block text-[10px] sm:text-[11px] font-semibold uppercase leading-tight text-gray-20 dark:text-gray-400 break-words line-clamp-2">
        {label}
      </span>
      <p className="mt-1 text-sm sm:text-base lg:text-lg font-bold text-cryptoNight dark:text-white break-words">
        {value}
      </p>
    </div>
  );
}
