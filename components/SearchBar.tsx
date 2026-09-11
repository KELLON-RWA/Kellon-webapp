"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChartNoAxesCombined,
  Coins,
  LayoutGrid,
  Landmark,
  Search,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { yieldService } from "@/services/api/yield";
import { isRwaStockListing, stocksService } from "@/services/api/stocks";
import { transferService } from "@/services/api/transfers";
import { transactionService } from "@/services/api/transactions";
import {
  formatRelativeDate,
  getTransactionAmountLabel,
  getTransactionStatusClasses,
  getTransactionStatusLabel,
  getTransactionTitle,
  isPositiveTransaction,
} from "@/lib/dashboard-utils";
import type { Asset, Transaction, User } from "@/types/db";

interface SearchBarProps {
  className?: string;
  profile?: User | null;
  variant?: "input" | "overlay";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type SearchResult = {
  id: string;
  label: string;
  description: string;
  href: string;
  type:
    | "asset"
    | "feature"
    | "transaction"
    | "user"
    | "yield"
    | "stock"
    | "rwa";
  transaction?: Transaction;
};

const resultGroupLabels: Record<SearchResult["type"], string> = {
  asset: "Wallet assets",
  feature: "Kellon features",
  yield: "Yield opportunities",
  stock: "Stocks",
  rwa: "Real-world assets",
  transaction: "Transactions",
  user: "Kellon users",
};

const resultGroupOrder: SearchResult["type"][] = [
  "asset",
  "feature",
  "yield",
  "stock",
  "rwa",
  "transaction",
  "user",
];

const kellonFeatures = [
  {
    label: "Buy crypto",
    description: "Add stablecoins with local currency",
    href: "/buy",
    keywords: "buy add funds deposit fiat onramp crypto",
  },
  {
    label: "Receive crypto",
    description: "View your wallet addresses",
    href: "/receive",
    keywords: "receive deposit address wallet crypto",
  },
  {
    label: "Send",
    description: "Send assets to another wallet or Kellon user",
    href: "/send",
    keywords: "send transfer pay recipient crypto",
  },
  {
    label: "Withdraw",
    description: "Convert stablecoins to your bank balance",
    href: "/withdraw",
    keywords: "withdraw sell offramp bank cash fiat",
  },
  {
    label: "Swap",
    description: "Exchange supported tokens",
    href: "/swap",
    keywords: "swap exchange convert trade token lifi",
  },
  {
    label: "Bridge",
    description: "Move assets between supported networks",
    href: "/bridge",
    keywords: "bridge chain network crosschain transfer lifi",
  },
  {
    label: "Cards",
    description: "Manage your Kellon cards",
    href: "/cards",
    keywords: "card virtual payment spend",
  },
  {
    label: "Invoices",
    description: "Create and manage payment invoices",
    href: "/invoices",
    keywords: "invoice request payment bill receive",
  },
  {
    label: "Gifts",
    description: "Send and manage crypto gifts",
    href: "/gifts",
    keywords: "gift send present crypto",
  },
  {
    label: "Earn",
    description: "Browse yield, stocks, and real-world assets",
    href: "/earn",
    keywords: "earn yield stock rwa invest apy opportunity",
  },
  {
    label: "Transactions",
    description: "View your complete activity history",
    href: "/transactions",
    keywords: "transaction activity history receipt payment",
  },
] as const;

function formatAmount(amount: Asset["amount"] | Transaction["amount"]): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return "0";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 6,
  }).format(value);
}

function normalize(value: unknown): string {
  return String(value || "").toLowerCase();
}

const SearchBar = ({
  className,
  profile,
  variant = "input",
  open,
  onOpenChange,
}: SearchBarProps) => {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [userResult, setUserResult] = useState<SearchResult | null>(null);
  const [transactionResult, setTransactionResult] =
    useState<SearchResult | null>(null);
  const [isLookingUpUser, setIsLookingUpUser] = useState(false);
  const [isLookingUpTransaction, setIsLookingUpTransaction] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchOpen = open ?? isSearchOpen;
  const setSearchOpen = (nextOpen: boolean) => {
    setIsSearchOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const trimmedQuery = query.trim();
  const lowerQuery = trimmedQuery.toLowerCase();
  const isLikelyTransactionId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      trimmedQuery,
    );
  const shouldSearchCatalog =
    trimmedQuery.length >= 2 && (isFocused || searchOpen);
  const { data: yieldOpportunities = [], isLoading: isLoadingYield } = useQuery(
    {
      queryKey: ["yield-opportunities"],
      queryFn: async () => (await yieldService.getOpportunities()).data,
      enabled: shouldSearchCatalog,
      staleTime: 60_000,
    },
  );
  const { data: stockListings = [], isLoading: isLoadingStocks } = useQuery({
    queryKey: ["available-stocks"],
    queryFn: async () => (await stocksService.getAvailableStocks("all")).data,
    enabled: shouldSearchCatalog,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (variant !== "input") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [variant]);

  useEffect(() => {
    if (!searchOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => inputRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [searchOpen]);

  useEffect(() => {
    if (trimmedQuery.length < 3 || isLikelyTransactionId) {
      setUserResult(null);
      setIsLookingUpUser(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setIsLookingUpUser(true);
      try {
        const response = await transferService.verifyRecipient(trimmedQuery);
        if (cancelled) return;

        if (response.data?.found) {
          setUserResult({
            id: `user:${trimmedQuery}`,
            label: response.data.name || trimmedQuery,
            description: "Kellon user",
            href: `/send?recipient=${encodeURIComponent(trimmedQuery)}`,
            type: "user",
          });
        } else {
          setUserResult(null);
        }
      } catch {
        if (!cancelled) setUserResult(null);
      } finally {
        if (!cancelled) setIsLookingUpUser(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [isLikelyTransactionId, trimmedQuery]);

  useEffect(() => {
    if (!isLikelyTransactionId) {
      setTransactionResult(null);
      setIsLookingUpTransaction(false);
      return;
    }

    const localMatch = (profile?.transactions || []).some(
      (transaction) => transaction.id.toLowerCase() === lowerQuery,
    );

    if (localMatch) {
      setTransactionResult(null);
      setIsLookingUpTransaction(false);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      setIsLookingUpTransaction(true);
      try {
        const response = await transactionService.getTransaction(trimmedQuery);
        if (cancelled) return;

        const transaction = response.data;
        setTransactionResult({
          id: `transaction-lookup:${transaction.id}`,
          label: getTransactionTitle(transaction),
          description: `${getTransactionAmountLabel(
            transaction,
          )} · ${formatRelativeDate(transaction.createdAt)}`,
          href: `/transactions/${transaction.id}`,
          type: "transaction",
          transaction,
        });
      } catch {
        if (!cancelled) setTransactionResult(null);
      } finally {
        if (!cancelled) setIsLookingUpTransaction(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [isLikelyTransactionId, lowerQuery, profile?.transactions, trimmedQuery]);

  const localResults = useMemo<SearchResult[]>(() => {
    if (!lowerQuery) return [];

    const assetResults = (profile?.assets || [])
      .filter((asset) => {
        const haystack = [
          asset.symbol,
          asset.chain,
          asset.assetType,
          formatAmount(asset.amount),
        ]
          .map(normalize)
          .join(" ");

        return haystack.includes(lowerQuery);
      })
      .slice(0, 3)
      .map((asset, index) => ({
        id: `asset:${asset.id || `${asset.symbol}:${asset.chain || "wallet"}:${index}`}`,
        label: asset.symbol,
        description: `${formatAmount(asset.amount)} ${asset.symbol}${
          asset.chain ? ` on ${asset.chain}` : ""
        }`,
        href: `/assets/${asset.symbol.toLowerCase()}`,
        type: "asset" as const,
      }));

    const transactionResults = (profile?.transactions || [])
      .filter((transaction) => {
        const haystack = [
          transaction.id,
          transaction.type,
          transaction.status,
          transaction.symbol,
          transaction.assetType,
          formatAmount(transaction.amount),
        ]
          .map(normalize)
          .join(" ");

        return haystack.includes(lowerQuery);
      })
      .slice(0, 4)
      .map((transaction, index) => ({
        id: `transaction:${transaction.id || `${transaction.type}:${transaction.symbol}:${index}`}`,
        label: getTransactionTitle(transaction),
        description: `${getTransactionAmountLabel(
          transaction,
        )} · ${formatRelativeDate(transaction.createdAt)}`,
        href: `/transactions/${transaction.id}`,
        type: "transaction" as const,
        transaction,
      }));

    const featureResults = kellonFeatures
      .filter((feature) =>
        normalize(
          `${feature.label} ${feature.description} ${feature.keywords}`,
        ).includes(lowerQuery),
      )
      .slice(0, 4)
      .map((feature) => ({
        id: `feature:${feature.href}`,
        label: feature.label,
        description: feature.description,
        href: feature.href,
        type: "feature" as const,
      }));

    return [...assetResults, ...featureResults, ...transactionResults];
  }, [lowerQuery, profile?.assets, profile?.transactions]);

  const catalogResults = useMemo<SearchResult[]>(() => {
    if (lowerQuery.length < 2) return [];

    const opportunityResults = yieldOpportunities
      .filter((opportunity) =>
        [
          opportunity.symbol,
          opportunity.protocol,
          opportunity.chain,
          opportunity.riskLevel,
        ]
          .map(normalize)
          .join(" ")
          .includes(lowerQuery),
      )
      .slice(0, 4)
      .map((opportunity) => ({
        id: `yield:${opportunity.id}`,
        label: `${opportunity.symbol} on ${opportunity.protocol.replace(/[-_]/g, " ")}`,
        description: `${Number(opportunity.apy).toFixed(2)}% APY · ${opportunity.chain}`,
        href: `/earn?category=yield&opportunity=${encodeURIComponent(opportunity.id)}`,
        type: "yield" as const,
      }));

    const securityResults = stockListings
      .filter((stock) =>
        [
          stock.symbol,
          stock.name,
          stock.provider,
          stock.category,
          stock.rwaCategory,
        ]
          .map(normalize)
          .join(" ")
          .includes(lowerQuery),
      )
      .slice(0, 6)
      .map((stock) => {
        const isRwa = isRwaStockListing(stock);
        const category = isRwa ? "rwa" : "stocks";

        return {
          id: `${isRwa ? "rwa" : "stock"}:${stock.provider}:${stock.symbol}`,
          label: stock.symbol,
          description: `${stock.name} · ${stock.provider}`,
          href: `/earn?category=${category}&stock=${encodeURIComponent(stock.symbol)}&provider=${encodeURIComponent(stock.provider)}`,
          type: (isRwa ? "rwa" : "stock") as "rwa" | "stock",
        };
      });

    return [...opportunityResults, ...securityResults];
  }, [lowerQuery, stockListings, yieldOpportunities]);

  const results = [
    ...(transactionResult ? [transactionResult] : []),
    ...(userResult ? [userResult] : []),
    ...localResults,
    ...catalogResults,
  ];
  const groupedResults = resultGroupOrder
    .map((type) => ({
      type,
      label: resultGroupLabels[type],
      results: results.filter((result) => result.type === type),
    }))
    .filter((group) => group.results.length > 0);
  const isSearching =
    isLookingUpUser ||
    isLookingUpTransaction ||
    isLoadingYield ||
    isLoadingStocks;
  const showResults = isFocused && trimmedQuery.length > 0;

  const closeSearch = () => {
    setQuery("");
    setIsFocused(false);
    setSearchOpen(false);
  };

  const renderResultGroups = (mobile = false) => {
    if (!trimmedQuery) {
      return (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-semibold text-cryptoNight dark:text-white">
            Search across Kellon
          </p>
          <p className="mt-1 text-xs text-gray-20 dark:text-white/48">
            Find wallet assets, Kellon features, Yield, Stocks, RWA,
            transactions, and users.
          </p>
        </div>
      );
    }

    if (!groupedResults.length) {
      return (
        <div className="p-5 text-center">
          <p className="text-sm font-semibold text-cryptoNight dark:text-white">
            {isSearching ? "Searching..." : "No results found"}
          </p>
          <p className="mt-1 text-xs text-gray-20 dark:text-white/48">
            Try an asset, protocol, stock, transaction, email, or Kellon tag.
          </p>
        </div>
      );
    }

    return (
      <div
        className={cn("overflow-y-auto p-1", mobile ? "flex-1" : "max-h-96")}
      >
        {groupedResults.map((group) => (
          <section key={group.type} className="py-1">
            <h3 className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase text-gray-30 dark:text-white/40">
              {group.label}
            </h3>
            {group.results.map((result) => {
              const isTransactionResult = result.type === "transaction";
              const isPositiveResult =
                result.transaction &&
                isPositiveTransaction(result.transaction.type);
              const Icon =
                result.type === "user"
                  ? UserRound
                  : result.type === "asset"
                    ? WalletCards
                    : result.type === "feature"
                      ? LayoutGrid
                      : result.type === "yield"
                        ? Coins
                        : result.type === "stock"
                          ? ChartNoAxesCombined
                          : result.type === "rwa"
                            ? Landmark
                            : isPositiveResult
                              ? ArrowDownLeft
                              : ArrowUpRight;

              return (
                <Link
                  key={result.id}
                  href={result.href}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 transition hover:bg-gray-95 dark:hover:bg-white/[0.06]"
                  onClick={closeSearch}
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      isTransactionResult && !isPositiveResult
                        ? "bg-gray-95 text-gray-20 dark:border dark:border-white/5 dark:bg-secondary-60 dark:text-gray-40"
                        : "bg-primary-95 text-primary-50 dark:border dark:border-primary-80/15 dark:bg-primary-70/20 dark:text-primary-90",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-cryptoNight dark:text-white">
                      {result.label}
                    </p>
                    {result.transaction ? (
                      <p className="truncate text-xs text-gray-20 dark:text-white/48">
                        <span>{result.description}</span>
                        <span className="px-1 text-gray-30 dark:text-white/30">
                          ·
                        </span>
                        <span
                          className={cn(
                            "font-medium",
                            getTransactionStatusClasses(
                              result.transaction.status,
                            ),
                          )}
                        >
                          {getTransactionStatusLabel(result.transaction.status)}
                        </span>
                      </p>
                    ) : (
                      <p className="truncate text-xs text-gray-20 dark:text-white/48">
                        {result.description}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </section>
        ))}
      </div>
    );
  };

  const searchField = (mobile = false) => (
    <div className="group relative w-full">
      <div className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-gray-40 transition-colors group-focus-within:text-primary-50 dark:text-white/70 dark:group-focus-within:text-primary-80">
        <Search className="h-4 w-4 dark:text-white/70" strokeWidth={2.25} />
      </div>
      <Input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          if (!mobile) {
            window.setTimeout(() => setIsFocused(false), 120);
          }
        }}
        placeholder="Search Kellon"
        aria-label="Search Kellon"
        className="h-10 w-full rounded-xl border-gray-80 bg-white/85 pl-10 pr-10 text-gray-20 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all placeholder:text-gray-30 focus-visible:border-primary-60 focus-visible:ring-1 focus-visible:ring-primary-50 [&::-webkit-search-cancel-button]:hidden dark:border-white/10 dark:bg-secondary-50/55 dark:text-white dark:shadow-none dark:placeholder:text-white/38 dark:focus-visible:border-primary-80 dark:focus-visible:ring-primary-80/70 1xl:pr-12"
      />
      {query ? (
        <button
          type="button"
          onClick={() => setQuery("")}
          aria-label="Clear Kellon search"
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-30 transition hover:bg-gray-90 hover:text-cryptoNight dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white 1xl:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      {!mobile ? (
        <div className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-gray-80 bg-gray-95 px-1.5 py-0.5 text-[10px] font-semibold text-gray-30 1xl:flex dark:border-white/10 dark:bg-secondary-60/70 dark:text-white/50">
          <span className="text-[12px]">⌘</span>K
        </div>
      ) : null}
    </div>
  );

  if (variant === "overlay") {
    return (
      <div className={className}>
        {searchOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-kellon-search-title"
            aria-describedby="mobile-kellon-search-description"
            className="fixed inset-0 z-[100] flex h-dvh w-full flex-col gap-4 bg-white p-4 md:hidden dark:bg-secondary-60"
          >
            <h2 id="mobile-kellon-search-title" className="sr-only">
              Search Kellon
            </h2>
            <p id="mobile-kellon-search-description" className="sr-only">
              Search wallet assets, Kellon features, Yield, Stocks, RWA,
              transactions, and Kellon users.
            </p>
            <div className="flex items-center gap-2">
              {searchField(true)}
              <button
                type="button"
                onClick={closeSearch}
                aria-label="Close search"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-80 bg-gray-95 text-gray-20 transition hover:text-cryptoNight dark:border-white/10 dark:bg-secondary-50 dark:text-gray-40 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderResultGroups(true)}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("group relative w-full max-w-sm", className)}>
      {searchField()}

      {showResults ? (
        <div className="absolute right-0 top-12 z-50 w-[360px] overflow-hidden rounded-xl border border-gray-80 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-white/10 dark:bg-secondary-50/95 dark:shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          {renderResultGroups()}
        </div>
      ) : null}
    </div>
  );
};

export default SearchBar;
