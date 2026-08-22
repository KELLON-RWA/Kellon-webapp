"use client";

import * as React from "react";
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
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { FC } from "react";
import ChainIcon from "@/components/wallet/ChainIcon";
import { cn } from "@/lib/utils";

interface Chain {
  id: string;
  name: string;
}

interface SelectNetworkModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  chains: Chain[];
  selectedChainId: string | null;
  onSelectChain: (chainId: string, chainName: string) => void;
}

const SelectNetworkModal: FC<SelectNetworkModalProps> = ({
  isOpen,
  onClose,
  chains,
  selectedChainId,
  onSelectChain,
}) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleSelectChain = (chainId: string, chainName: string) => {
    onSelectChain(chainId, chainName);
    onClose(false);
  };

  const content = (
    <div className="flex max-h-[82dvh] flex-col px-4 pb-8 md:max-h-[70dvh] md:px-0 md:pb-0">
      <div className="flex justify-start mb-6">
        <button
          onClick={() => onClose(false)}
          className="p-2 bg-white dark:bg-secondary-60/50 rounded-full border border-black/5 dark:border-none hover:opacity-80 transition-opacity outline-none cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-white" />
        </button>
      </div>

      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold text-black dark:text-white">
          Select Network
        </h2>
        <p className="text-sm text-gray-500 dark:text-secondary-90">
          Choose the blockchain network
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {chains.map((chain) => {
          const isSelected = selectedChainId === chain.id;
          const chainName = chain.name;
          const chainId = chain.id;

          return (
            <button
              key={chain.id}
              onClick={() => handleSelectChain(chainId, chainName)}
              className={cn(
                "w-full rounded-[24px] border p-5 text-left transition-all group outline-none cursor-pointer",
                isSelected
                  ? "border-primary-60 bg-primary-70/5 ring-2 ring-primary-60/20"
                  : "border-black/5 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-50 dark:hover:bg-secondary-60/50",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center border border-black/5 dark:border-white/5">
                    <ChainIcon name={chain.name} size={20} />
                  </div>
                  <div className="text-left">
                    <p
                      className={cn(
                        "text-sm font-bold",
                        isSelected
                          ? "text-primary-60"
                          : "text-black dark:text-white",
                      )}
                    >
                      {chain.name}
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <CheckCircle2 className="h-5 w-5 text-primary-70" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {chains.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No networks available
          </p>
        </div>
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px] bg-gray-70 dark:bg-black2 border-none rounded-[32px] outline-none [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Select Network</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[90dvh] bg-gray-70 dark:bg-black2 border-none rounded-t-[32px] outline-none [&>button]:hidden">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Select Network</DrawerTitle>
        </DrawerHeader>
        {content}
      </DrawerContent>
    </Drawer>
  );
};

export default SelectNetworkModal;
