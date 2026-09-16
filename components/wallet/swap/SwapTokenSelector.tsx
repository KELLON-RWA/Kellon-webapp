"use client";

import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import ChainIcon from "@/components/wallet/ChainIcon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { SwapAssetOption } from "@/lib/swap-assets";
import { formatSwapAmount, getTokenIcon } from "./utils";

interface Props {
  open: boolean;
  title: string;
  description?: string;
  tokens: SwapAssetOption[];
  selectedKey?: string;
  showBalance?: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (key: string) => void;
}

function TokenLogo({ token }: { token: SwapAssetOption }) {
  return (
    <span
      aria-hidden="true"
      className="h-10 w-10 shrink-0 rounded-full bg-gray-90 bg-cover bg-center dark:bg-secondary-60"
      style={{
        backgroundImage: `url("${token.symbol.toUpperCase() === "USDT" ? getTokenIcon(token.symbol) : token.logoURI || getTokenIcon(token.symbol)}")`,
      }}
    />
  );
}

export function SwapTokenSelector({
  open,
  title,
  description = "Tokens available through LI.FI",
  tokens,
  selectedKey,
  showBalance = false,
  onOpenChange,
  onSelect,
}: Props) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tokens.slice(0, 100);
    return tokens
      .filter((token) =>
        [token.symbol, token.name, token.chainName, token.tokenAddress]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 100);
  }, [search, tokens]);

  const content = (
    <div className="flex min-h-0 flex-col p-4 md:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-black dark:text-white">
            {title}
          </h2>
          <p className="mt-1 text-xs text-gray-500">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-black/5 bg-white text-gray-500 transition hover:text-black dark:border-white/10 dark:bg-secondary-50 dark:hover:text-white"
          aria-label="Close token selector"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search token or network"
          className="h-11 rounded-xl border-black/5 bg-white pl-9 shadow-none dark:border-white/10 dark:bg-secondary-50"
        />
      </div>
      <ScrollArea className="h-[52dvh] md:h-[420px]">
        <div className="space-y-1 pr-3">
          {filtered.map((token) => {
            const selected = token.key === selectedKey;
            return (
              <button
                key={token.key}
                type="button"
                onClick={() => {
                  onSelect(token.key);
                  onOpenChange(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? "border-primary-60 bg-primary-70/10" : "border-transparent hover:border-black/5 hover:bg-white dark:hover:border-white/10 dark:hover:bg-secondary-50"}`}
              >
                <TokenLogo token={token} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-black dark:text-white">
                      {token.symbol}
                    </span>
                    <span className="truncate text-xs text-gray-500">
                      {token.name}
                    </span>
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500">
                    <ChainIcon
                      name={token.chainKey}
                      size={14}
                      className="!h-3.5 !w-3.5"
                    />
                    {token.chainName}
                  </span>
                </span>
                {showBalance ? (
                  <span className="shrink-0 text-right text-xs font-semibold text-black dark:text-white">
                    {formatSwapAmount(token.balance)}
                  </span>
                ) : selected ? (
                  <Check className="h-4 w-4 shrink-0 text-primary-60" />
                ) : null}
              </button>
            );
          })}
          {!filtered.length ? (
            <p className="py-10 text-center text-sm text-gray-500">
              No matching token found.
            </p>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden rounded-2xl border-black/5 bg-gray-70 p-0 dark:border-white/10 dark:bg-black2 sm:max-w-md"
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {description}
          </DialogDescription>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88dvh] rounded-t-[24px] border-black/5 bg-gray-70 dark:border-white/10 dark:bg-black2">
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <DrawerDescription className="sr-only">{description}</DrawerDescription>
        {content}
      </DrawerContent>
    </Drawer>
  );
}
