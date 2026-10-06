"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
  type TransitionEvent,
} from "react";
import AssetInfoModal from "@/components/modals/AssetInfoModal";
import { useDetectCountry } from "@/hooks/use-detect-country";
import { useExchangeRate } from "@/hooks/use-exchange-rate";
import type { SupportedChainKeys } from "@/lib/chains";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { getTransactionSymbol } from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";
import priceService from "@/services/price-service";
import { transactionService } from "@/services/api/transactions";
import { getActivityRefetchInterval } from "@/lib/transaction-polling";
import type { Asset, User } from "@/types/db";
import { AssetChainView } from "./AssetChainView";
import { AssetDetailsHeader } from "./AssetDetailsHeader";
import { AssetDetailsTabs } from "./AssetDetailsTabs";
import { AssetOverviewView } from "./AssetOverviewView";
import {
  CHAIN_ORDER,
  DEFAULT_TOKEN_PRICE,
  HIDDEN_CHAINS,
  type ChainBalance,
  getChainColor,
  getShortChainLabel,
  getTransactionChain,
  normalizeChain,
  parseAmount,
} from "./asset-details-utils";

interface AssetDetailsPageProps {
  profile: User;
  symbol: string;
  initialChain?: string;
}

export default function AssetDetailsPage({
  profile,
  symbol,
  initialChain,
}: AssetDetailsPageProps) {
  const router = useRouter();
  const normalizedSymbol = symbol.toUpperCase();
  const { currencyCode } = useDetectCountry();
  const localCurrency = currencyCode || "USD";
  const { exchangeRate, isRateLoading } = useExchangeRate(localCurrency, null);
  const [tokenPrice, setTokenPrice] = useState(DEFAULT_TOKEN_PRICE);
  const [isPriceLoading, setIsPriceLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialChain || "overview");
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [copiedAddressChain, setCopiedAddressChain] = useState<string | null>(
    null,
  );
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swipeViewportRef = useRef<HTMLDivElement>(null);
  const activeSlideRef = useRef<HTMLDivElement>(null);
  const incomingSlideRef = useRef<HTMLDivElement>(null);
  const swipeOffsetRef = useRef(0);
  const swipeFrameRef = useRef<number | null>(null);
  const [swipeTarget, setSwipeTarget] = useState<string | null>(null);
  const [isSwipeDragging, setIsSwipeDragging] = useState(false);
  const [isSwipeSettling, setIsSwipeSettling] = useState(false);
  const [shouldCommitSwipe, setShouldCommitSwipe] = useState(false);

  const assetHoldings = useMemo(
    () =>
      (profile.assets || []).filter(
        (asset): asset is Asset =>
          Boolean(asset) && asset.symbol?.toUpperCase() === normalizedSymbol,
      ),
    [normalizedSymbol, profile.assets],
  );

  useEffect(() => {
    let isCancelled = false;

    const loadPrice = async () => {
      setIsPriceLoading(true);

      try {
        const prices = await priceService.getMultipleTokenPrices([
          normalizedSymbol,
        ]);

        if (!isCancelled) {
          setTokenPrice(prices[normalizedSymbol] || DEFAULT_TOKEN_PRICE);
        }
      } catch {
        if (!isCancelled) {
          setTokenPrice(DEFAULT_TOKEN_PRICE);
        }
      } finally {
        if (!isCancelled) {
          setIsPriceLoading(false);
        }
      }
    };

    loadPrice();

    return () => {
      isCancelled = true;
    };
  }, [normalizedSymbol]);

  const supportedChainKeys = useMemo<string[]>(() => {
    if (normalizedSymbol === "USDC" || normalizedSymbol === "USDT") {
      return CHAIN_ORDER;
    }

    return [];
  }, [normalizedSymbol]);

  const chainBalances = useMemo<ChainBalance[]>(() => {
    const totals = new Map<string, number>();

    assetHoldings.forEach((asset) => {
      const chain = normalizeChain(asset.chain);
      if (HIDDEN_CHAINS.has(chain)) return;
      if (
        supportedChainKeys.length > 0 &&
        !supportedChainKeys.includes(chain)
      ) {
        return;
      }

      totals.set(chain, (totals.get(chain) || 0) + parseAmount(asset.amount));
    });

    supportedChainKeys.forEach((chain) => {
      if (!totals.has(chain)) totals.set(chain, 0);
    });

    const totalAmount = Array.from(totals.values()).reduce(
      (sum, amount) => sum + amount,
      0,
    );

    return Array.from(totals.entries())
      .map(([chain, amount], index) => ({
        chain,
        label: getShortChainLabel(chain),
        amount,
        percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
        value: amount * tokenPrice * exchangeRate,
        color: getChainColor(chain, index),
      }))
      .sort((left, right) => {
        const leftIndex = CHAIN_ORDER.indexOf(left.chain as SupportedChainKeys);
        const rightIndex = CHAIN_ORDER.indexOf(
          right.chain as SupportedChainKeys,
        );

        if (leftIndex === -1 && rightIndex === -1) {
          return right.amount - left.amount;
        }
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      });
  }, [assetHoldings, exchangeRate, supportedChainKeys, tokenPrice]);

  const totalAmount = useMemo(
    () =>
      chainBalances.reduce(
        (runningTotal, balance) => runningTotal + balance.amount,
        0,
      ),
    [chainBalances],
  );
  const totalValue = totalAmount * tokenPrice * exchangeRate;
  const activeChainBalance =
    activeTab === "overview"
      ? null
      : chainBalances.find((item) => item.chain === activeTab) || null;
  const isValueLoading = isRateLoading || isPriceLoading;

  const activeChainAddress = useMemo(() => {
    if (!activeChainBalance) return null;

    const account = (profile.chainAccounts || []).find(
      (chainAccount) =>
        normalizeChain(chainAccount.chain) === activeChainBalance.chain,
    );

    return account?.smartAccountAddress || account?.publicKey || null;
  }, [activeChainBalance, profile.chainAccounts]);

  const { data: allTransactions = [], isLoading: isTransactionsLoading } =
    useQuery({
      queryKey: ["transactions"],
      queryFn: async () => {
        const response = await transactionService.getTransactions();
        return response.data || [];
      },
      staleTime: 5_000,
      refetchInterval: (query) => getActivityRefetchInterval(query.state.data),
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    });

  const assetTabs = useMemo(
    () => ["overview", ...chainBalances.map((balance) => balance.chain)],
    [chainBalances],
  );

  const selectTab = (tab: string) => {
    if (isSwipeSettling || !assetTabs.includes(tab) || tab === activeTab)
      return;

    setActiveTab(tab);
    const query = tab === "overview" ? "" : `?network=${tab}`;
    router.replace(`/assets/${normalizedSymbol.toLowerCase()}${query}`, {
      scroll: false,
    });
  };

  const getAdjacentTab = (tab: string, direction: -1 | 1) => {
    const index = assetTabs.indexOf(tab);
    return assetTabs[index + direction] || null;
  };

  const getSwipeViewportWidth = () =>
    swipeViewportRef.current?.clientWidth || window.innerWidth;

  const applySwipeOffset = (offset: number) => {
    swipeOffsetRef.current = offset;

    if (activeSlideRef.current) {
      activeSlideRef.current.style.transform = `translate3d(${offset}px, 0, 0)`;
    }

    if (incomingSlideRef.current) {
      const viewportWidth = getSwipeViewportWidth();
      const incomingOffset =
        offset < 0 ? viewportWidth + offset : -viewportWidth + offset;
      incomingSlideRef.current.style.transform = `translate3d(${incomingOffset}px, 0, 0)`;
    }
  };

  const queueSwipeOffset = (offset: number) => {
    swipeOffsetRef.current = offset;
    if (swipeFrameRef.current !== null) return;

    swipeFrameRef.current = window.requestAnimationFrame(() => {
      swipeFrameRef.current = null;
      applySwipeOffset(swipeOffsetRef.current);
    });
  };

  const clearSwipeTransforms = () => {
    if (swipeFrameRef.current !== null) {
      window.cancelAnimationFrame(swipeFrameRef.current);
      swipeFrameRef.current = null;
    }

    swipeOffsetRef.current = 0;
    if (activeSlideRef.current) activeSlideRef.current.style.transform = "";
    if (incomingSlideRef.current) incomingSlideRef.current.style.transform = "";
  };

  const resetSwipe = () => {
    clearSwipeTransforms();
    setSwipeTarget(null);
    setIsSwipeDragging(false);
    setIsSwipeSettling(false);
    setShouldCommitSwipe(false);
  };

  useEffect(() => {
    if (!swipeTarget || !incomingSlideRef.current) return;

    const viewportWidth =
      swipeViewportRef.current?.clientWidth || window.innerWidth;
    const offset = swipeOffsetRef.current;
    const incomingOffset =
      offset < 0 ? viewportWidth + offset : -viewportWidth + offset;
    incomingSlideRef.current.style.transform = `translate3d(${incomingOffset}px, 0, 0)`;
  }, [swipeTarget]);

  useEffect(
    () => () => {
      if (swipeFrameRef.current !== null) {
        window.cancelAnimationFrame(swipeFrameRef.current);
      }
    },
    [],
  );

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (isSwipeSettling) return;

    const target = event.target as HTMLElement;
    if (
      target.closest(
        "button, a, input, textarea, select, [role='button'], [role='link']",
      )
    ) {
      swipeStart.current = null;
      return;
    }

    const touch = event.touches[0];
    swipeStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    if (!start) return;

    const touch = event.touches[0];
    const horizontalDistance = touch.clientX - start.x;
    const verticalDistance = touch.clientY - start.y;

    if (
      Math.abs(verticalDistance) > Math.abs(horizontalDistance) &&
      Math.abs(verticalDistance) > 8
    ) {
      swipeStart.current = null;
      resetSwipe();
      return;
    }

    if (Math.abs(horizontalDistance) < 8) return;

    const direction: -1 | 1 = horizontalDistance < 0 ? 1 : -1;
    const targetTab = getAdjacentTab(activeTab, direction);
    const viewportWidth = getSwipeViewportWidth();
    const resistance = targetTab ? 1 : 0.22;
    const nextOffset = Math.max(
      -viewportWidth,
      Math.min(viewportWidth, horizontalDistance * resistance),
    );

    setIsSwipeDragging(true);
    setSwipeTarget(targetTab);
    queueSwipeOffset(nextOffset);
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;

    const touch = event.changedTouches[0] || event.touches[0];
    if (!touch) {
      resetSwipe();
      return;
    }
    const horizontalDistance = touch.clientX - start.x;
    const verticalDistance = touch.clientY - start.y;

    const direction: -1 | 1 = horizontalDistance < 0 ? 1 : -1;
    const destination = getAdjacentTab(activeTab, direction);

    if (Math.abs(horizontalDistance) < 8 || !destination) {
      resetSwipe();
      return;
    }

    const viewportWidth = getSwipeViewportWidth();
    const shouldComplete =
      Math.abs(horizontalDistance) >= Math.min(72, viewportWidth * 0.2) &&
      Math.abs(horizontalDistance) > Math.abs(verticalDistance) * 1.3;

    setIsSwipeDragging(false);
    setIsSwipeSettling(true);

    if (!shouldComplete) {
      setSwipeTarget(destination);
      setShouldCommitSwipe(false);
      window.requestAnimationFrame(() => applySwipeOffset(0));
      return;
    }

    setSwipeTarget(destination);
    setShouldCommitSwipe(true);
    window.requestAnimationFrame(() =>
      applySwipeOffset(horizontalDistance < 0 ? -viewportWidth : viewportWidth),
    );
  };

  const handleTouchCancel = () => {
    swipeStart.current = null;

    if (!swipeTarget) {
      resetSwipe();
      return;
    }

    setIsSwipeDragging(false);
    setIsSwipeSettling(true);
    setShouldCommitSwipe(false);
    window.requestAnimationFrame(() => applySwipeOffset(0));
  };

  const handleSwipeTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (
      event.target !== event.currentTarget ||
      event.propertyName !== "transform" ||
      !isSwipeSettling
    ) {
      return;
    }

    if (shouldCommitSwipe && swipeTarget) {
      setActiveTab(swipeTarget);
      const query = swipeTarget === "overview" ? "" : `?network=${swipeTarget}`;
      router.replace(`/assets/${normalizedSymbol.toLowerCase()}${query}`, {
        scroll: false,
      });
    }

    resetSwipe();
  };

  const handleCopyAddress = async () => {
    if (!activeChainAddress || !activeChainBalance) return;

    const copied = await copyToClipboard(
      activeChainAddress,
      `${activeChainBalance.label} address copied`,
    );

    if (!copied) return;

    setCopiedAddressChain(activeChainBalance.chain);
    window.setTimeout(() => {
      setCopiedAddressChain((currentChain) =>
        currentChain === activeChainBalance.chain ? null : currentChain,
      );
    }, 2000);
  };

  const handleAction = (action: "send" | "buy" | "withdraw" | "bridge") => {
    const query = activeChainBalance
      ? `?asset=${normalizedSymbol}&network=${activeChainBalance.chain}`
      : `?asset=${normalizedSymbol}`;

    if (action === "send") router.push(`/send${query}`);
    if (action === "buy") router.push(`/buy${query}`);
    if (action === "withdraw") router.push(`/withdraw${query}`);
    if (action === "bridge") router.push(`/bridge${query}`);
  };

  const renderAssetView = (tab: string) => {
    const chainBalance =
      tab === "overview"
        ? null
        : chainBalances.find((item) => item.chain === tab) || null;
    const amount = chainBalance?.amount ?? totalAmount;
    const value = chainBalance?.value ?? totalValue;
    const chainAddress = chainBalance
      ? (() => {
          const account = (profile.chainAccounts || []).find(
            (chainAccount) =>
              normalizeChain(chainAccount.chain) === chainBalance.chain,
          );

          return account?.smartAccountAddress || account?.publicKey || null;
        })()
      : null;
    const chainTransactions = chainBalance
      ? allTransactions
          .filter(
            (transaction) =>
              getTransactionSymbol(transaction) === normalizedSymbol &&
              getTransactionChain(transaction) === chainBalance.chain,
          )
          .sort(
            (left, right) =>
              new Date(right.createdAt).getTime() -
              new Date(left.createdAt).getTime(),
          )
      : [];

    if (chainBalance) {
      return (
        <AssetChainView
          symbol={normalizedSymbol}
          activeChainBalance={chainBalance}
          displayAmount={amount}
          displayValue={value}
          localCurrency={localCurrency}
          tokenPrice={tokenPrice}
          exchangeRate={exchangeRate}
          activeChainAddress={chainAddress}
          copiedAddressChain={copiedAddressChain}
          transactions={chainTransactions}
          isTransactionsLoading={isTransactionsLoading}
          isBalanceVisible={isBalanceVisible}
          isValueLoading={isValueLoading}
          onCopyAddress={handleCopyAddress}
          onAction={handleAction}
          onViewTransaction={(transactionId) =>
            router.push(`/transactions/${transactionId}`)
          }
        />
      );
    }

    return (
      <AssetOverviewView
        symbol={normalizedSymbol}
        chainBalances={chainBalances}
        activeTab={tab}
        displayAmount={amount}
        displayValue={value}
        localCurrency={localCurrency}
        isBalanceVisible={isBalanceVisible}
        isValueLoading={isValueLoading}
        onSelectChain={selectTab}
      />
    );
  };

  return (
    <div
      className={cn(
        "container mx-auto flex min-h-[90dvh] w-full touch-pan-y flex-col px-4 pb-28 pt-4 md:px-6 md:pb-16 md:pt-20",
        activeChainBalance ? "max-w-2xl" : "max-w-5xl",
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <AssetDetailsHeader
        symbol={normalizedSymbol}
        isBalanceVisible={isBalanceVisible}
        onBack={() => router.back()}
        onToggleBalance={() => setIsBalanceVisible((value) => !value)}
        onOpenInfo={() => setIsInfoOpen(true)}
      />

      <AssetDetailsTabs
        activeTab={activeTab}
        pendingTab={isSwipeDragging || shouldCommitSwipe ? swipeTarget : null}
        chainBalances={chainBalances}
        onChange={selectTab}
      />

      <div ref={swipeViewportRef} className="relative flex-1 overflow-hidden">
        {swipeTarget ? (
          <div
            key={swipeTarget}
            ref={incomingSlideRef}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 w-full will-change-transform",
              isSwipeDragging
                ? "transition-none"
                : "transition-transform duration-200 ease-out",
            )}
          >
            {renderAssetView(swipeTarget)}
          </div>
        ) : null}

        <div
          key={activeTab}
          ref={activeSlideRef}
          className={cn(
            "relative w-full will-change-transform",
            isSwipeDragging
              ? "transition-none"
              : "transition-transform duration-200 ease-out",
          )}
          onTransitionEnd={handleSwipeTransitionEnd}
        >
          {renderAssetView(activeTab)}
        </div>
      </div>

      <AssetInfoModal
        isOpen={isInfoOpen}
        onClose={setIsInfoOpen}
        symbol={normalizedSymbol}
        localCurrency={localCurrency}
        price={tokenPrice * exchangeRate}
        exchangeRate={exchangeRate}
        isLoading={isValueLoading}
      />
    </div>
  );
}
