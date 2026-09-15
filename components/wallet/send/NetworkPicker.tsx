"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import ChainIcon from "@/components/wallet/ChainIcon";
import { getChainLabel } from "@/lib/chains";
import { cn } from "@/lib/utils";
import type { SendableAsset } from "./send-types";
import { formatAssetAmount } from "./send-utils";

interface NetworkPickerProps {
  symbol: string;
  networks: SendableAsset[];
  selectedNetwork: SendableAsset;
  onSelectNetwork: (assetKey: string) => void;
}

export default function NetworkPicker({
  symbol,
  networks,
  selectedNetwork,
  onSelectNetwork,
}: NetworkPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const orderedNetworks = useMemo(
    () => [
      selectedNetwork,
      ...networks.filter((network) => network.key !== selectedNetwork.key),
    ],
    [networks, selectedNetwork],
  );

  const selectNetwork = (network: SendableAsset) => {
    onSelectNetwork(network.key);
    setIsOpen(false);
  };

  const content = (
    <div className="flex max-h-[82dvh] flex-col px-4 pb-7 pt-4 md:max-h-[70dvh] md:px-0 md:pb-0">
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-black/5 bg-white text-gray-600 transition hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-60/50 dark:text-white dark:hover:bg-secondary-60"
        aria-label="Close network picker"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <div className="mb-6 mt-4 text-center">
        <h2 className="text-xl font-bold text-black dark:text-white">
          Select network
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Choose where to send {symbol} from.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {orderedNetworks.map((network) => {
          const isSelected = network.key === selectedNetwork.key;
          return (
            <button
              key={network.key}
              type="button"
              onClick={() => selectNetwork(network)}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all",
                isSelected
                  ? "border-primary-60 bg-primary-70/5 ring-2 ring-primary-60/20"
                  : "border-black/5 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-50 dark:hover:bg-secondary-60/50",
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-95 dark:bg-secondary-60">
                  <ChainIcon name={network.chain} size={28} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-black dark:text-white">
                    {getChainLabel(network.chain)}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                    {formatAssetAmount(network.amount)} {symbol}
                  </span>
                </span>
              </span>
              {isSelected ? (
                <Check className="h-5 w-5 shrink-0 text-primary-60" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );

  const trigger = (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className="flex h-14 w-full cursor-pointer items-center gap-3 rounded-xl border border-black/5 bg-white px-3 text-left text-black shadow-none transition hover:border-primary-60/40 dark:border-white/10 dark:bg-secondary-60 dark:text-white"
      aria-haspopup="dialog"
      aria-expanded={isOpen}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        <ChainIcon
          name={selectedNetwork.chain}
          size={28}
          className="!h-7 !w-7 shrink-0"
        />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
        {getChainLabel(selectedNetwork.chain)}
      </span>
      <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
        {formatAssetAmount(selectedNetwork.amount)} {symbol}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
    </button>
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="rounded-[28px] border-none bg-gray-70 p-6 outline-none dark:bg-black2 sm:max-w-[420px] [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Select network</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="max-h-[90dvh] rounded-t-[28px] border-none bg-gray-70 outline-none dark:bg-black2 [&>button]:hidden">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Select network</DrawerTitle>
        </DrawerHeader>
        {content}
      </DrawerContent>
    </Drawer>
  );
}
