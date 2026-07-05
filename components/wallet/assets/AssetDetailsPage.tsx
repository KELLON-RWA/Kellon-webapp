"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AssetInfoModal from "@/components/modals/AssetInfoModal";
import { useDetectCountry } from "@/hooks/use-detect-country";
import { useExchangeRate } from "@/hooks/use-exchange-rate";
import type { SupportedChainKeys } from "@/lib/chains";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { getTransactionSymbol } from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";
import priceService from "@/services/price-service";
import { transactionService } from "@/services/api/transactions";
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
}

export default function AssetDetailsPage({
  profile,
  symbol,
}: AssetDetailsPageProps) {
  const router = useRouter();
  const normalizedSymbol = symbol.toUpperCase();
  const { currencyCode } = useDetectCountry();
  const localCurrency = currencyCode || "USD";
  const { exchangeRate, isRateLoading } = useExchangeRate(localCurrency, null);
  const [tokenPrice, setTokenPrice] = useState(DEFAULT_TOKEN_PRICE);
  const [isPriceLoading, setIsPriceLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [copiedAddressChain, setCopiedAddressChain] = useState<string | null>(
    null,
  );

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
  const displayAmount = activeChainBalance?.amount ?? totalAmount;
  const displayValue = activeChainBalance?.value ?? totalValue;
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
      staleTime: 1000 * 60 * 2,
    });

  const activeChainTransactions = useMemo(() => {
    if (!activeChainBalance) return [];

    return allTransactions
      .filter((transaction) => {
        if (getTransactionSymbol(transaction) !== normalizedSymbol) {
          return false;
        }

        const transactionChain = getTransactionChain(transaction);
        return transactionChain === activeChainBalance.chain;
      })
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      );
  }, [activeChainBalance, normalizedSymbol, allTransactions]);

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

  const handleAction = (action: "send" | "buy" | "withdraw") => {
    const query = activeChainBalance
      ? `?asset=${normalizedSymbol}&network=${activeChainBalance.chain}`
      : `?asset=${normalizedSymbol}`;

    if (action === "send") router.push(`/send${query}`);
    if (action === "buy") router.push(`/buy${query}`);
    if (action === "withdraw") router.push(`/withdraw${query}`);
  };

  return (
    <div
      className={cn(
        "container mx-auto flex min-h-[90dvh] w-full flex-col px-4 pb-28 pt-4 md:px-6 md:pb-16 md:pt-20",
        activeChainBalance ? "max-w-2xl" : "max-w-5xl",
      )}
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
        chainBalances={chainBalances}
        onChange={setActiveTab}
      />

      {activeChainBalance ? (
        <AssetChainView
          symbol={normalizedSymbol}
          activeChainBalance={activeChainBalance}
          displayAmount={displayAmount}
          displayValue={displayValue}
          localCurrency={localCurrency}
          tokenPrice={tokenPrice}
          exchangeRate={exchangeRate}
          activeChainAddress={activeChainAddress}
          copiedAddressChain={copiedAddressChain}
          transactions={activeChainTransactions}
          isTransactionsLoading={isTransactionsLoading}
          isBalanceVisible={isBalanceVisible}
          isValueLoading={isValueLoading}
          onCopyAddress={handleCopyAddress}
          onAction={handleAction}
          onViewTransaction={(transactionId) =>
            router.push(`/transactions/${transactionId}`)
          }
        />
      ) : (
        <AssetOverviewView
          symbol={normalizedSymbol}
          chainBalances={chainBalances}
          activeTab={activeTab}
          displayAmount={displayAmount}
          displayValue={displayValue}
          localCurrency={localCurrency}
          isBalanceVisible={isBalanceVisible}
          isValueLoading={isValueLoading}
          onSelectChain={setActiveTab}
        />
      )}

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
