"use client";

import { FC, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { useSupportedChains } from "@/hooks/use-supported-chains";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Search, SearchX } from "lucide-react";
import TokenSelect from "./TokenSelect";
import { type Token } from "@lifi/sdk";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChainSkeletonItem,
  TopChainSkeletonItem,
} from "@/components/Skeletons";

// Component Props
interface ChainSelectProps {
  side: "from" | "to";
  selectedChain: number;
  handleChainSelectOpen: (side: "from" | "to") => void;
  tokens?: Token[];
  loading: boolean;
  selectedToken: Token | null;
}

const ChainSelect: FC<ChainSelectProps> = ({
  side,
  selectedChain,
  handleChainSelectOpen,
  loading,
  selectedToken,
  tokens,
}) => {
  // Hooks & State
  const { chains, loading: chainsLoading } = useSupportedChains();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();

  // Helpers
  const filteredChains = chains.filter((chain) =>
    chain.name.toLowerCase().includes(search.toLowerCase()),
  );

  const buildUrl = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    return `/?${params.toString()}`;
  };

  const topChains = chains.slice(0, 8);
  return (
    <>
      {/* =================== MOBILE VIEW =================== */}
      <div className="block w-full md:hidden">
        <Card className="w-[90dvw] max-w-[90dvw] bg-white dark:bg-secondary-10 border border-input rounded-2xl max-h-[80dvh] xm:max-h-[80dvh] sm:max-h-[80dvh] md:max-h-[70vh] card-scroll">
          <CardContent className="p-4 flex flex-col space-y-4">
            {/* Header */}
            <div className="flex items-center relative w-full">
              <ArrowLeft
                onClick={() => handleChainSelectOpen("from")}
                className="absolute left-0"
              />
              <div className="mx-auto text-center">Swap from</div>
            </div>

            {/* Top Chains */}
            <div className="grid grid-cols-5 gap-3">
              {chainsLoading
                ? [...Array(8)].map((_, index) => (
                    <TopChainSkeletonItem key={`top-skeleton-${index}`} />
                  ))
                : topChains.map((chain) => (
                    <Link
                      href={buildUrl(
                        side === "from" ? "fromChain" : "toChain",
                        chain.id.toString(),
                      )}
                      key={chain.id}
                      className={cn(
                        "flex flex-col items-center justify-center p-2 border border-input rounded-xl transition text-black dark:text-white cursor-pointer",
                        selectedChain === chain.id &&
                          "border-primary bg-accent shadow",
                      )}
                    >
                      <Image
                        src={chain.logoURI ?? ""}
                        alt={chain.name}
                        width={36}
                        height={36}
                        className="rounded-full"
                      />
                    </Link>
                  ))}
              {/* +Others Button */}
              {chainsLoading ? (
                <div className="flex items-center justify-center border border-input rounded-xl">
                  <div className="w-9 h-9 bg-gray-300 rounded-xl animate-pulse"></div>
                </div>
              ) : (
                <button
                  onClick={() => setOpen(true)}
                  className="flex items-center justify-center border border-input rounded-xl hover:bg-accent transition text-black dark:text-white text-xs cursor-pointer"
                >
                  +{chains.length - topChains.length}
                </button>
              )}
            </div>

            {/* Token Selector */}
            <TokenSelect
              side={side}
              tokens={tokens}
              loading={loading}
              selectedToken={selectedToken}
              onClose={handleChainSelectOpen}
            />
          </CardContent>
        </Card>

        {/* All Chains Dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="rounded-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 outline-none dark:bg-none dark:bg-black2">
            <DialogHeader>
              <DialogTitle className="text-black dark:text-white">
                Select Chain
              </DialogTitle>
            </DialogHeader>

            {/* Search Input */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search chain"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-full bg-white2 dark:bg-secondary-60 border-input text-black dark:text-white placeholder:text-gray-400 placeholder:text-xs"
              />
            </div>

            {/* Search Results */}
            <div className="max-h-80 overflow-y-auto">
              {chainsLoading ? (
                [...Array(6)].map((_, index) => (
                  <ChainSkeletonItem key={`dialog-skeleton-${index}`} />
                ))
              ) : filteredChains.length > 0 ? (
                filteredChains.map((chain) => (
                  <Link
                    href={buildUrl(
                      side === "from" ? "fromChain" : "toChain",
                      chain.id.toString(),
                    )}
                    key={chain.id}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white2 dark:hover:bg-secondary-60 hover:rounded-lg transition text-black dark:text-white cursor-pointer",
                      selectedChain === chain.id &&
                        "bg-purple-100 dark:bg-secondary-70 rounded-lg",
                    )}
                  >
                    <Image
                      src={chain.logoURI ?? ""}
                      alt={chain.name}
                      width={28}
                      height={28}
                      className="rounded-full"
                    />
                    <span className="text-sm font-medium">{chain.name}</span>
                  </Link>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                  <SearchX className="w-10 h-10 mb-2" />
                  <p className="text-sm">No chains found</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* =================== DESKTOP VIEW =================== */}
      <div className="hidden md:flex">
        <Card className="bg-white dark:bg-secondary-10 border border-input rounded-l-2xl rounded-r-none h-[600px]">
          <CardContent className="p-4 space-y-4">
            {/* Search Input */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search chain"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-full bg-white2 dark:bg-secondary-60 border-input text-black dark:text-white placeholder:text-gray-400 placeholder:text-xs"
              />
            </div>

            {/* Chain List */}
            <div>
              {chainsLoading ? (
                <div className="max-h-[500px] overflow-y-auto">
                  {[...Array(6)].map((_, index) => (
                    <ChainSkeletonItem key={`desktop-skeleton-${index}`} />
                  ))}
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  {filteredChains.length > 0 ? (
                    filteredChains.map((chain) => (
                      <Link
                        href={buildUrl(
                          side === "from" ? "fromChain" : "toChain",
                          chain.id.toString(),
                        )}
                        key={chain.id}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-primary-99 dark:hover:bg-secondary-60 rounded-lg hover:rounded-lg transition text-black dark:text-white cursor-pointer",
                          selectedChain === chain.id &&
                            "bg-purple-100 dark:bg-secondary-70 rounded-lg",
                        )}
                      >
                        <Image
                          src={chain.logoURI ?? ""}
                          alt={chain.name}
                          width={28}
                          height={28}
                          className="rounded-full"
                        />
                        <span className="text-sm font-medium">
                          {chain.name}
                        </span>
                      </Link>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
                      <SearchX className="w-10 h-10 mb-2" />
                      <p className="text-sm">No chains found</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Token Selector */}
        <TokenSelect
          side={side}
          tokens={tokens}
          loading={loading}
          selectedToken={selectedToken}
          onClose={handleChainSelectOpen}
        />
      </div>
    </>
  );
};

export default ChainSelect;
