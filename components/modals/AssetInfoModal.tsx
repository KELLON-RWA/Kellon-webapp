"use client";

import { ArrowLeft, Globe2 } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { formatCurrencyAmount } from "@/lib/dashboard-utils";
import { cn } from "@/lib/utils";

interface AssetInfo {
  name: string;
  description: string;
  marketCap: string;
  athUsd: number;
  change24h: number;
  website: string;
}

interface AssetInfoModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  symbol: string;
  localCurrency: string;
  price: number;
  exchangeRate: number;
  isLoading: boolean;
}

const DEFAULT_TOKEN_PRICE = 1;
const ASSET_INFO: Record<string, AssetInfo> = {
  USDC: {
    name: "USD Coin",
    description:
      "USDC is a fully collateralized US dollar stablecoin designed for fast digital payments and settlement. It helps move dollar value across supported blockchain networks while keeping its price closely aligned to one US dollar.",
    marketCap: "$75.43B",
    athUsd: 1.04,
    change24h: 0,
    website: "https://www.circle.com/usdc",
  },
  USDT: {
    name: "Tether USD",
    description:
      "USDT is a US dollar-pegged stablecoin used for trading, payments, and transfers across supported blockchain networks. It is designed to maintain a value close to one US dollar.",
    marketCap: "$112.00B",
    athUsd: 1.32,
    change24h: 0,
    website: "https://tether.to",
  },
};

export default function AssetInfoModal({
  isOpen,
  onClose,
  symbol,
  localCurrency,
  price,
  exchangeRate,
  isLoading,
}: AssetInfoModalProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const normalizedSymbol = symbol.toUpperCase();
  const assetInfo = ASSET_INFO[normalizedSymbol] || {
    name: normalizedSymbol,
    description:
      "This asset is supported by Kellon across selected networks. Availability, transfers, and withdrawal options may vary by chain.",
    marketCap: "Unavailable",
    athUsd: DEFAULT_TOKEN_PRICE,
    change24h: 0,
    website: "",
  };

  const content = (
    <AssetInfoPanel
      assetInfo={assetInfo}
      localCurrency={localCurrency}
      price={price}
      exchangeRate={exchangeRate}
      isLoading={isLoading}
      onClose={() => onClose(false)}
    />
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-[32px] border-none bg-gray-70 outline-none dark:bg-black2 sm:max-w-[425px] [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>About {assetInfo.name}</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="rounded-t-[32px] border-none bg-gray-70 outline-none dark:bg-black2 [&>button]:hidden">
        <DrawerHeader className="sr-only">
          <DrawerTitle>About {assetInfo.name}</DrawerTitle>
        </DrawerHeader>
        {content}
      </DrawerContent>
    </Drawer>
  );
}

function AssetInfoPanel({
  assetInfo,
  localCurrency,
  price,
  exchangeRate,
  isLoading,
  onClose,
}: {
  assetInfo: AssetInfo;
  localCurrency: string;
  price: number;
  exchangeRate: number;
  isLoading: boolean;
  onClose: () => void;
}) {
  const changeColor =
    assetInfo.change24h > 0
      ? "text-emerald-500"
      : assetInfo.change24h < 0
        ? "text-red-500"
        : "text-gray-500 dark:text-gray-400";

  return (
    <div className="px-4 pb-8 md:px-0 md:pb-0">
      <div className="mb-6 flex justify-start">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="cursor-pointer rounded-full border border-black/5 bg-white p-2 outline-none transition-opacity hover:opacity-80 dark:border-none dark:bg-secondary-60/50"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-white" />
        </button>
      </div>

      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold text-black dark:text-white">
          About {assetInfo.name}
        </h2>
        <p className="text-sm text-gray-500 dark:text-secondary-90">
          Market information and asset details
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
        <AssetInfoMetric
          label="Price"
          value={
            isLoading
              ? "Updating..."
              : formatCurrencyAmount(price, localCurrency)
          }
        />
        <AssetInfoMetric
          label="24h Change"
          value={`${assetInfo.change24h.toFixed(2)}%`}
          valueClassName={changeColor}
        />
        <AssetInfoMetric label="Market Cap" value={assetInfo.marketCap} />
        <AssetInfoMetric
          label="ATH"
          value={formatCurrencyAmount(
            assetInfo.athUsd * exchangeRate,
            localCurrency,
          )}
        />
      </div>

      <div className="mt-7 space-y-3">
        <h3 className="text-base font-bold text-black dark:text-white">
          Description
        </h3>
        <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">
          {assetInfo.description}
        </p>
      </div>

      {assetInfo.website ? (
        <a
          href={assetInfo.website}
          target="_blank"
          rel="noreferrer"
          className="mx-auto mt-8 flex w-fit cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-primary-60 transition hover:bg-primary-70/10 dark:text-primary-80 dark:hover:bg-white/5"
        >
          <Globe2 className="h-5 w-5" />
          Official Website
        </a>
      ) : null}
    </div>
  );
}

function AssetInfoMetric({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-[24px] border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-secondary-60">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-3 text-base font-bold text-black dark:text-white md:text-lg",
          valueClassName,
        )}
      >
        {value}
      </p>
    </div>
  );
}
