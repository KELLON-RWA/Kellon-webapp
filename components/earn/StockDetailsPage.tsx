"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  BarChart2,
  Building2,
  CandlestickChart,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Globe,
  LineChart,
  RefreshCw,
  Scale,
  ShieldCheck,
  Star,
  TrendingDown,
  TrendingUp,
  Vote,
  WalletCards,
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
import type { CompanyNewsArticle, CompanyNewsSource } from "@/lib/company-news";
import { getCompanyNewsName } from "@/lib/company-news";
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
import {
  formatUsd,
  getStockProviderLabel,
  getStockSettlementChain,
  resolveStockCategory,
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

const PINNED_TIMEFRAMES = ["Time", "1s", "15m", "1h", "4h", "1D", "1W"] as const;
const AVAILABLE_TIMEFRAMES = [
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

  useEffect(() => {
    if (!isMoreOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        moreDropdownRef.current &&
        !moreDropdownRef.current.contains(event.target as Node)
      ) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
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
    staleTime: 30_000,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });

  // Finnhub data
  const { data: exchangeMarketData, refetch: refetchFinnhubMarketData } =
    useQuery({
      queryKey: ["finnhub-stock-market-data", normalizedSymbol],
      queryFn: () =>
        stockResearchService.getFinnhubMarketData(normalizedSymbol),
      enabled: Boolean(stock) && !isRwa,
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchInterval: 5 * 60_000,
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
    staleTime: 5 * 60_000,
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
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
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

  // Price & Stats
  const currentPrice =
    tradingData?.stats?.currentPrice ||
    Number(finnhubMarketData?.quote?.current || stock?.price || 265.61);

  const changePercent =
    tradingData?.stats?.change24hPercent ??
    finnhubMarketData?.quote?.percentChange ??
    0;

  const isPositive = changePercent >= 0;

  const high24h =
    tradingData?.stats?.high24h ||
    finnhubMarketData?.quote?.high ||
    currentPrice * 1.02;

  const low24h =
    tradingData?.stats?.low24h ||
    finnhubMarketData?.quote?.low ||
    currentPrice * 0.98;

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
    <main className="mx-auto min-h-[100dvh] w-full max-w-[1600px] px-3 sm:px-4 pb-36 pt-4 md:px-6 md:pb-24 md:max-lg:pt-20 lg:max-w-none lg:px-6 lg:pt-3.5 xl:px-8">
      {/* 1. Header Bar */}
      <header className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-secondary-60/60 text-white transition hover:bg-secondary-60 active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-sm font-bold text-white sm:text-base">
            {name.replace(/\s*Tokenized Stock$/i, "")} Tokenized Stock
          </h1>
          <p className="truncate text-xs text-gray-400">
            {displayStockSymbol}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshAll}
            aria-label="Refresh"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-secondary-60/60 text-white transition hover:bg-secondary-60 active:scale-95 lg:hidden"
          >
            <RefreshCw
              className={cn("h-4 w-4 text-gray-300", isRefetching && "animate-spin")}
            />
          </button>
          <div className="hidden h-10 w-10 lg:block" aria-hidden="true" />
        </div>
      </header>

      {/* 2. Top Tabs: Charts, Company, News, Token Info, Data */}
      <nav
        className="mb-4 grid grid-cols-5 gap-1 rounded-xl border border-white/10 bg-secondary-60/40 p-1 backdrop-blur"
        aria-label="Stock tabs"
      >
        {STOCK_PAGE_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "h-9 rounded-lg px-1 truncate text-[11px] font-semibold transition sm:text-sm",
              activeTab === tab
                ? "bg-gradient-to-r from-primary-70 to-primary-60 font-bold text-white shadow-lg shadow-primary-60/20"
                : "text-gray-400 hover:text-white hover:bg-white/5",
            )}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Main Grid: Left Column for Chart/Content, Right Column for Binance-style Desktop Sidebar */}
      <div className="grid grid-cols-1 gap-6 min-[1200px]:grid-cols-[minmax(0,1fr)_340px] min-[1400px]:grid-cols-[minmax(0,1fr)_380px] min-[1200px]:items-start">
        {/* Left Column: Charts / Company / Token Info / Data content */}
        <div className="min-w-0">
          {activeTab === "Charts" ? (
        <div className="space-y-4">
          {/* 3. Stock Summary Card */}
          <section className="rounded-2xl border border-white/10 bg-secondary-50/70 p-3 sm:p-5 shadow-lg backdrop-blur">
            {/* Top Row: Logo + Symbol + Network Badge + Watchlist Star (Left) & Historical Performance (Right on Desktop) */}
            <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-2 shrink-0">
                <StockLogo symbol={displayStockSymbol} src={stockLogoUrl} size="sm" />
                <span className="text-base font-bold text-white sm:text-lg">
                  {displayStockSymbol}
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleWatchlist()}
                  aria-label={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
                  className="group flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-white/10 active:scale-95"
                >
                  <Star
                    className={cn(
                      "h-4 w-4 transition-colors",
                      isWatchlisted
                        ? "fill-primary-50 text-primary-50"
                        : "text-gray-400 group-hover:text-white",
                    )}
                  />
                </button>
              </div>

              {/* Desktop Performance Metrics: next to logo/heading in top row */}
              <div className="hidden lg:flex items-center gap-5 xl:gap-8 text-right">
                <div>
                  <p className="text-[11px] text-gray-400">Today</p>
                  <p
                    className={cn(
                      "mt-0.5 text-xs font-bold tabular-nums sm:text-sm",
                      performance.today >= 0 ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {performance.today >= 0 ? "+" : ""}
                    {performance.today.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">7 Days</p>
                  <p
                    className={cn(
                      "mt-0.5 text-xs font-bold tabular-nums sm:text-sm",
                      performance.days7 >= 0 ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {performance.days7 >= 0 ? "+" : ""}
                    {performance.days7.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">30 Days</p>
                  <p
                    className={cn(
                      "mt-0.5 text-xs font-bold tabular-nums sm:text-sm",
                      performance.days30 >= 0 ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {performance.days30 >= 0 ? "+" : ""}
                    {performance.days30.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">90 Days</p>
                  <p
                    className={cn(
                      "mt-0.5 text-xs font-bold tabular-nums sm:text-sm",
                      performance.days90 >= 0 ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {performance.days90 >= 0 ? "+" : ""}
                    {performance.days90.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">180 Days</p>
                  <p
                    className={cn(
                      "mt-0.5 text-xs font-bold tabular-nums sm:text-sm",
                      performance.days180 >= 0 ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {performance.days180 >= 0 ? "+" : ""}
                    {performance.days180.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>

            {/* Subtle Divider Line */}
            <div className="my-3.5 border-t border-white/10" />

            {/* Bottom Row: Price & 24h Pill on Left, 2x2 Stats Grid on Right */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              {/* Left Column: Price & 24h Change Pill */}
              <div>
                <p
                  className={cn(
                    "text-2xl font-bold tabular-nums sm:text-3xl",
                    isPositive ? "text-emerald-400" : "text-rose-500",
                  )}
                >
                  {formatUsd(currentPrice)}
                </p>
                <div className="mt-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                      isPositive
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-rose-500/15 text-rose-400",
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
                  <p className="text-[11px] text-gray-400">24h High</p>
                  <p className="mt-0.5 text-xs font-semibold tabular-nums text-white sm:text-sm">
                    {formatUsd(high24h)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">
                    24h Vol ({displayStockSymbol})
                  </p>
                  <p className="mt-0.5 text-xs font-semibold tabular-nums text-white sm:text-sm">
                    {formatCompactVolume(vol24h)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">24h Low</p>
                  <p className="mt-0.5 text-xs font-semibold tabular-nums text-white sm:text-sm">
                    {formatUsd(low24h)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">24h Turnover ($)</p>
                  <p className="mt-0.5 text-xs font-semibold tabular-nums text-white sm:text-sm">
                    {formatCompactTurnover(turnover24h)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Timeframe Bar & Chart Controls */}
          <section className="relative rounded-2xl border border-white/10 bg-secondary-50/50 p-2 sm:p-3 backdrop-blur">
            <div className="flex items-center justify-between gap-1 text-xs">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar sm:gap-2">
                  {PINNED_TIMEFRAMES.map((tf) => {
                    const isActive =
                      tf === "Time"
                        ? chartType === "line"
                        : chartType === "candlestick" && activeInterval === tf;

                    return (
                      <button
                        key={tf}
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
                          "relative px-2.5 py-1.5 font-semibold transition rounded-md shrink-0 cursor-pointer",
                          isActive
                            ? "bg-primary-70/25 text-primary-70 shadow-[inset_0_0_0_1px_rgba(193,92,165,0.20)]"
                            : "text-gray-400 hover:text-white",
                        )}
                      >
                        {tf}
                      </button>
                    );
                  })}
                </div>

                {/* More dropdown */}
                <div className="relative shrink-0" ref={moreDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsMoreOpen((v) => !v)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1.5 font-semibold transition rounded-md cursor-pointer",
                      (AVAILABLE_TIMEFRAMES as readonly string[]).includes(activeInterval) &&
                        chartType === "candlestick"
                        ? "bg-primary-70/25 text-primary-70 shadow-[inset_0_0_0_1px_rgba(193,92,165,0.20)]"
                        : isMoreOpen
                          ? "bg-white/10 text-white"
                          : "text-gray-400 hover:text-white hover:bg-white/5",
                    )}
                  >
                    <span>
                      {(AVAILABLE_TIMEFRAMES as readonly string[]).includes(activeInterval) &&
                      chartType === "candlestick"
                        ? activeInterval
                        : "More"}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform duration-200",
                        isMoreOpen && "rotate-180",
                      )}
                    />
                  </button>

                  {isMoreOpen ? (
                    <div className="absolute left-0 top-full z-50 mt-2 w-72 sm:w-80 rounded-2xl border border-white/10 bg-secondary-60/95 p-3.5 sm:p-4 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150">
                      {/* Pinned Section */}
                      <div className="mb-2.5 flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
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
                                "flex h-8.5 items-center justify-center rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95",
                                isActive
                                  ? "border border-primary-60/40 bg-primary-70/20 text-primary-60 shadow-[0_0_12px_rgba(193,92,165,0.25)] font-bold"
                                  : "border border-white/5 bg-white/5 text-gray-300 hover:border-white/10 hover:bg-white/10 hover:text-white",
                              )}
                            >
                              {item}
                            </button>
                          );
                        })}
                      </div>

                      {/* Divider */}
                      <div className="my-3 border-t border-white/10" />

                      {/* Available Section */}
                      <div className="mb-2.5 flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
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
                                "flex h-8.5 items-center justify-center rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95",
                                isActive
                                  ? "border border-primary-60/40 bg-primary-70/20 text-primary-60 shadow-[0_0_12px_rgba(193,92,165,0.25)] font-bold"
                                  : "border border-white/5 bg-white/5 text-gray-300 hover:border-white/10 hover:bg-white/10 hover:text-white",
                              )}
                            >
                              {item}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
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

            {/* 5. OHLC & MA Readout */}
            <div className="mt-3 border-t border-white/5 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-[10px] text-gray-400 sm:text-[11px]">
                <span>{hoveredData?.timeStr || "Loading..."}</span>
                {hoveredData ? (
                  <div className="flex items-center gap-2 tabular-nums">
                    <span>
                      O <span className="text-white">{hoveredData.open.toFixed(2)}</span>
                    </span>
                    <span>
                      H <span className="text-emerald-400">{hoveredData.high.toFixed(2)}</span>
                    </span>
                    <span>
                      L <span className="text-rose-400">{hoveredData.low.toFixed(2)}</span>
                    </span>
                    <span>
                      C <span className={hoveredData.close >= hoveredData.open ? "text-emerald-400" : "text-rose-400"}>
                        {hoveredData.close.toFixed(2)}
                      </span>
                    </span>
                  </div>
                ) : null}
              </div>

              {activeIndicators.has("MA") && hoveredData ? (
                <div className="mt-1 flex items-center gap-3 text-[10px] tabular-nums">
                  {hoveredData.ma5 !== undefined ? (
                    <span className="text-amber-400 font-medium">
                      MA(5): {hoveredData.ma5.toFixed(2)}
                    </span>
                  ) : null}
                  {hoveredData.ma10 !== undefined ? (
                    <span className="text-purple-400 font-medium">
                      MA(10): {hoveredData.ma10.toFixed(2)}
                    </span>
                  ) : null}
                  {hoveredData.ma20 !== undefined ? (
                    <span className="text-cyan-400 font-medium">
                      MA(20): {hoveredData.ma20.toFixed(2)}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* 6. Trading Chart Canvas */}
            <div className="mt-2 h-[340px] w-full sm:h-[420px] lg:h-[480px]">
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
                  className="h-full"
                />
              )}
            </div>

            {/* Volume Status bar */}
            {activeIndicators.has("VOL") && hoveredData ? (
              <div className="mt-1 flex items-center gap-3 border-t border-white/5 pt-1.5 text-[10px] text-gray-400 tabular-nums">
                <span>VOL: {formatCompactVolume(hoveredData.volume)}</span>
                {hoveredData.volMa5 !== undefined ? (
                  <span className="text-amber-400 font-medium">
                    MA(5): {formatCompactVolume(hoveredData.volMa5)}
                  </span>
                ) : null}
                {hoveredData.volMa10 !== undefined ? (
                  <span className="text-purple-400 font-medium">
                    MA(10): {formatCompactVolume(hoveredData.volMa10)}
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* 7. Indicator Selector Pills */}
            <div className="mt-3 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar border-t border-white/5 pt-2 text-[10px] sm:gap-2 sm:text-[11px]">
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
                        : "text-gray-400 hover:text-white",
                    )}
                  >
                    {ind}
                  </button>
                ))}
              </div>

              <div className="h-3.5 w-px shrink-0 bg-white/10" />

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
                        : "text-gray-400 hover:text-white",
                    )}
                  >
                    {ind}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* 8. 5-Column Historical Performance Table (Mobile only; desktop renders in top summary card) */}
          <section className="grid grid-cols-5 gap-1 rounded-2xl border border-white/10 bg-secondary-50/70 p-2 sm:p-3 text-center backdrop-blur lg:hidden">
            <div>
              <p className="text-[9px] text-gray-400 sm:text-xs">Today</p>
              <p
                className={cn(
                  "mt-0.5 text-[11px] font-bold tabular-nums sm:mt-1 sm:text-sm",
                  performance.today >= 0 ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {performance.today >= 0 ? "+" : ""}
                {performance.today.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 sm:text-xs">7 Days</p>
              <p
                className={cn(
                  "mt-0.5 text-[11px] font-bold tabular-nums sm:mt-1 sm:text-sm",
                  performance.days7 >= 0 ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {performance.days7 >= 0 ? "+" : ""}
                {performance.days7.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 sm:text-xs">30 Days</p>
              <p
                className={cn(
                  "mt-0.5 text-[11px] font-bold tabular-nums sm:mt-1 sm:text-sm",
                  performance.days30 >= 0 ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {performance.days30 >= 0 ? "+" : ""}
                {performance.days30.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 sm:text-xs">90 Days</p>
              <p
                className={cn(
                  "mt-0.5 text-[11px] font-bold tabular-nums sm:mt-1 sm:text-sm",
                  performance.days90 >= 0 ? "text-emerald-400" : "text-rose-400",
                )}
              >
                {performance.days90 >= 0 ? "+" : ""}
                {performance.days90.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-[9px] text-gray-400 sm:text-xs">180 Days</p>
              <p
                className={cn(
                  "mt-0.5 text-[11px] font-bold tabular-nums sm:mt-1 sm:text-sm",
                  performance.days180 >= 0 ? "text-emerald-400" : "text-rose-400",
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
            <section className="rounded-2xl border border-white/10 bg-secondary-50/70 p-4 sm:p-5 backdrop-blur flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-white">My Position</h2>
                  {holding ? (
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                        holding.unrealizedPnL >= 0
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-rose-500/15 text-rose-400",
                      )}
                    >
                      {holding.unrealizedPnL >= 0 ? "+" : ""}
                      {holding.unrealizedPnLPercentage.toFixed(2)}%
                    </span>
                  ) : null}
                </div>

                {!holding ? (
                  <div className="my-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                      <WalletCards className="h-6 w-6 text-gray-400" />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-white">
                      No Active Position
                    </h3>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-gray-400">
                      You do not own any {displayStockSymbol} shares yet. Start
                      investing with fractional shares from just $1.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-y-4 border-t border-white/5 pt-4 text-xs">
                    <div>
                      <p className="text-gray-400">Shares Owned</p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-white">
                        {holding.shares.toFixed(4)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400">Total Value</p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-white">
                        {formatUsd(holding.currentValue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Average Cost</p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-white">
                        {formatUsd(holding.avgBuyPrice)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400">Total Return</p>
                      <p
                        className={cn(
                          "mt-1 text-sm font-bold tabular-nums",
                          holding.unrealizedPnL >= 0
                            ? "text-emerald-400"
                            : "text-rose-400",
                        )}
                      >
                        {holding.unrealizedPnL >= 0 ? "+" : ""}
                        {formatUsd(holding.unrealizedPnL)} (
                        {holding.unrealizedPnL >= 0 ? "+" : ""}
                        {holding.unrealizedPnLPercentage.toFixed(2)}%)
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Average Sell</p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-amber-400">
                        {avgSellPrice > 0 ? formatUsd(avgSellPrice) : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400">Realized Status</p>
                      <p className="mt-1 text-sm font-bold text-white">
                        {sellTransactions.length > 0 ? "Settled Exit" : "Open Position"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 10. Recent Activity Card */}
            <section className="rounded-2xl border border-white/10 bg-secondary-50/70 p-4 sm:p-5 backdrop-blur flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-white">Recent Activity</h2>
                  {stockActivities.length > 0 ? (
                    <span className="text-xs text-gray-400">
                      {Math.min(stockActivities.length, 10)} of {stockActivities.length}
                    </span>
                  ) : null}
                </div>

                {isStockActivitiesLoading ? (
                  <div className="mt-4 space-y-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-14 animate-pulse rounded-xl bg-white/5"
                      />
                    ))}
                  </div>
                ) : stockActivities.length === 0 ? (
                  <div className="my-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                      <Clock className="h-6 w-6 text-gray-400" />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-white">
                      No Past Transactions
                    </h3>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-gray-400">
                      Your completed buy and sell orders for {displayStockSymbol} will
                      appear here.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 divide-y divide-white/5">
                    {stockActivities.slice(0, 10).map((transaction) => {
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
                                  ? "border-purple-800/40 bg-purple-950/40 text-purple-300"
                                  : "border-emerald-800/40 bg-emerald-950/40 text-emerald-300",
                              )}
                            >
                              {isSale ? (
                                <TrendingDown className="h-4 w-4" />
                              ) : (
                                <TrendingUp className="h-4 w-4" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white sm:text-sm">
                                {isSale ? "Sell" : "Buy"} {displayStockSymbol}
                              </p>
                              <p className="text-[11px] text-gray-400">
                                {dateStr} • {settlementChain.toLowerCase()}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p
                              className={cn(
                                "text-xs font-bold tabular-nums sm:text-sm",
                                isSale ? "text-purple-300" : "text-emerald-400",
                              )}
                            >
                              {isSale ? "-" : "+"}
                              {shares > 0 ? shares.toFixed(6) : "0.00"} {displayStockSymbol}
                            </p>
                            <p className="text-[11px] text-gray-400 tabular-nums">
                              {isSale ? "+" : "-"}${fiatAmount.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
          companyNewsSource={companyNewsData?.source}
          isCompanyNewsLoading={isCompanyNewsLoading}
          isCompanyNewsError={isCompanyNewsError}
          provider={stock?.provider || "Backing"}
          settlementChain={settlementChain}
          price={currentPrice}
          chartHigh={high24h}
          chartLow={low24h}
          dexPool={dexScreenerData?.pair || null}
          isDexScreenerLoading={isDexScreenerLoading}
          hasDexPoolMetadata={Boolean(dexTokenAddress || dexPairAddress)}
          rwaCategory={stock?.rwaCategory}
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
                className="h-12 flex-1 rounded-xl bg-rose-500 text-base font-bold text-white shadow-lg shadow-rose-900/30 hover:bg-rose-600 active:scale-[0.98] transition cursor-pointer"
                onClick={() => setStockAction("sell")}
              >
                Sell{stockActionSymbol ? ` ${stockActionSymbol}` : ""}
              </Button>
              <Button
                type="button"
                className="h-12 flex-1 rounded-xl bg-gradient-to-r from-primary-70 to-primary-60 text-base font-bold text-white shadow-lg shadow-primary-60/30 hover:brightness-110 active:scale-[0.98] transition cursor-pointer"
                onClick={() => setStockAction("buy")}
              >
                Buy{stockActionSymbol ? ` ${stockActionSymbol}` : ""}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              className="h-12 w-full rounded-xl bg-gradient-to-r from-primary-70 to-primary-60 text-base font-bold text-white shadow-lg shadow-primary-60/30 hover:brightness-110 active:scale-[0.98] transition cursor-pointer"
              onClick={() => setStockAction("buy")}
            >
              Buy{stockActionSymbol ? ` ${stockActionSymbol}` : ""}
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

function CompanyDescription({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = text.length > 200;

  return (
    <div className="mt-4 max-w-3xl">
      <p
        className={cn(
          "text-sm leading-6 text-gray-300 transition-all",
          !isExpanded && isLong && "line-clamp-3",
        )}
      >
        {text}
      </p>
      {isLong ? (
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
  turnover24h,
  description,
  company,
  finnhubMarketData,
  companyNews,
  newsFacts,
  wikidataProfile,
  companyNewsSource,
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
}: {
  tab: Exclude<StockPageTab, "Charts">;
  title: string;
  ticker?: string;
  turnover24h?: number;
  description: string;
  company?: CompanyProfile;
  finnhubMarketData?: FinnhubMarketData;
  companyNews: CompanyNewsArticle[];
  newsFacts: NewsCompanyFacts;
  wikidataProfile?: WikidataCompanyProfile;
  companyNewsSource?: CompanyNewsSource;
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
}) {
  const officialProfile = finnhubMarketData?.profile;
  const metric = (key: string) => finnhubMarketData?.metrics?.[key];
  const hasFinnhubData = Boolean(
    finnhubMarketData?.quote ||
      officialProfile ||
      Object.keys(finnhubMarketData?.metrics || {}).length,
  );

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
      <div className="space-y-4">
        {/* 1. Company Overview & Facts */}
        <section className="rounded-2xl border border-white/10 bg-secondary-50/70 p-5 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-2 text-xl font-bold text-white">
              {company?.name ||
                wikidataProfile?.name ||
                officialProfile?.name ||
                title}
            </h2>
            <span className="rounded-full border border-primary-60/40 bg-primary-70/10 px-2.5 py-1 text-xs font-semibold text-primary-40">
              {categoryLabel}
            </span>
            {company?.industry && company.industry.toLowerCase() !== categoryLabel.toLowerCase() ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-gray-300">
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
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary-60/40 bg-primary-70/10 px-5 text-sm font-semibold text-primary-40 transition hover:bg-primary-70/20 active:scale-[0.99]"
            >
              <Globe className="h-4 w-4" />
              Visit Official Website <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}

          <div className="mt-6 grid grid-cols-2 gap-3">
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
        <section className="rounded-2xl border border-white/10 bg-secondary-50/70 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Key Metrics</h2>
            <span className="rounded-full border border-primary-60/40 bg-primary-70/10 px-2.5 py-0.5 text-xs font-semibold text-primary-40">
              Financial Overview
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <MetricBox label="Market Cap" value={marketCapValue} />
            <MetricBox label="P/E Ratio" value={peRatioValue} />
            <MetricBox label="Dividend Yield" value={dividendYieldValue} />
            <MetricBox label="24h Volume" value={volume24hValue} />
            <MetricBox label="Avg Volume" value={avgVolumeValue} />
            <MetricBox label="52-Week Range" value={range52wValue} />
          </div>
        </section>

        {/* 3. Financial Summary Card */}
        <section className="rounded-2xl border border-white/10 bg-secondary-50/70 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Financial Summary</h2>
            <span className="rounded-full border border-primary-60/40 bg-primary-70/10 px-2.5 py-0.5 text-xs font-semibold text-primary-40">
              Fundamentals (TTM)
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
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
      <div className="space-y-4">
        {/* Latest news */}
        <section className="rounded-2xl border border-white/10 bg-secondary-50/70 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Latest news</h2>
              <p className="mt-0.5 text-xs text-gray-400">
                Live market news and updates for {title}
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-gray-400">
              {companyNewsSource || "Company news"}
            </span>
          </div>

          {isCompanyNewsLoading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          ) : isCompanyNewsError ? (
            <p className="mt-4 text-xs text-gray-400">
              News is temporarily unavailable.
            </p>
          ) : companyNews.length ? (
            <div className="mt-4 divide-y divide-white/10">
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
                    <p className="text-sm font-semibold text-white">
                      {article.title}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {article.source}
                      {article.publishedAt ? ` • ${new Date(article.publishedAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 shrink-0 text-primary-40" />
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-xs text-gray-400">No news articles found.</p>
          )}
        </section>
      </div>
    );
  }

  if (tab === "Token Info") {
    return (
      <div className="space-y-4">
        <section className="rounded-2xl border border-white/10 bg-secondary-50/70 p-5 backdrop-blur">
          <h2 className="text-lg font-bold text-white">Tokenholder Protections</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoBox
              icon={<ShieldCheck className="h-4 w-4 text-emerald-400" />}
              title="1:1 Regulated Custody"
              desc="Underlying public equities are held by licensed trust custodians in segregated bankruptcy-remote accounts."
            />
            <InfoBox
              icon={<Vote className="h-4 w-4 text-primary-40" />}
              title="Pass-Through Rights"
              desc="Corporate actions and dividend distributions are reflected on-chain according to smart contract specifications."
            />
            <InfoBox
              icon={<Scale className="h-4 w-4 text-cyan-400" />}
              title="Continuous Compliance"
              desc="Audited reserves and collateral proofs ensure on-chain tokens mirror real-world custody balances."
            />
            <InfoBox
              icon={<Building2 className="h-4 w-4 text-amber-400" />}
              title="Settlement Network"
              desc={`Tokenized on ${settlementChain} with instant settlement and 24/7 liquidity access.`}
            />
          </div>
        </section>
      </div>
    );
  }

  // Data tab
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-secondary-50/70 p-5 backdrop-blur">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Market & Valuation Data</h2>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            {hasFinnhubData ? "Live Finnhub" : "Market Data"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <DataMetric label="Official Price" value={formatUsd(price)} />
          <DataMetric label="24h High" value={formatUsd(chartHigh)} />
          <DataMetric label="24h Low" value={formatUsd(chartLow)} />
          <DataMetric
            label="Market Cap"
            value={
              officialProfile?.marketCap
                ? `$${(officialProfile.marketCap / 1000).toFixed(2)}B`
                : "Not available"
            }
          />
          <DataMetric
            label="10D Avg Volume"
            value={formatCompactVolume(Number(metric("10DayAverageTradingVolume") || 0))}
          />
          <DataMetric
            label="52-Week Range"
            value={
              metric("52WeekLow") && metric("52WeekHigh")
                ? `$${metric("52WeekLow")} - $${metric("52WeekHigh")}`
                : "Not available"
            }
          />
        </div>
      </section>

      {dexPool ? (
        <section className="rounded-2xl border border-white/10 bg-secondary-50/70 p-5 backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">On-Chain DEX Liquidity</h2>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
              Live DexScreener
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DataMetric label="Pool Price" value={formatUsd(Number(dexPool.priceUsd || 0))} />
            <DataMetric label="Liquidity" value={formatCompactTurnover(dexPool.liquidityUsd || 0)} />
            <DataMetric label="24h Volume" value={formatCompactTurnover(dexPool.volume24hUsd || 0)} />
            <DataMetric
              label="24h Change"
              value={
                dexPool.change24hPercentage !== undefined
                  ? `${dexPool.change24hPercentage >= 0 ? "+" : ""}${dexPool.change24hPercentage.toFixed(2)}%`
                  : "—"
              }
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.04] p-3.5 sm:p-4">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </span>
      <p className="mt-1 text-base font-bold text-white sm:text-lg">
        {value}
      </p>
    </div>
  );
}

function InfoBox({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/5 p-4">
      <div className="flex items-center gap-2 text-white">
        {icon}
        <h3 className="text-xs font-bold sm:text-sm">{title}</h3>
      </div>
      <p className="mt-2 text-xs leading-5 text-gray-400">{desc}</p>
    </div>
  );
}

function DataMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/5 p-3">
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}
