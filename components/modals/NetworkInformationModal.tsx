"use client";

import { FC, useEffect } from "react";
import { Info, ArrowLeft, Activity } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

interface NetworkItem {
  name: string;
  chainId: string | number;
  isActive: boolean;
}

const NETWORKS: NetworkItem[] = [
  { name: "Stellar", chainId: 0, isActive: true },
  { name: "Base", chainId: 8453, isActive: true },
  { name: "Polygon", chainId: 137, isActive: true },
  { name: "Celo", chainId: 42220, isActive: true },
  { name: "Arc", chainId: 5042, isActive: true },
  { name: "BNB Chain", chainId: 56, isActive: true },
];

interface NetworkInformationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NetworkInformationModal: FC<NetworkInformationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const isMobile = useMediaQuery("(max-width: 768px)");

  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        document.body.style.pointerEvents = "auto";
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const Content = () => (
    <div className="px-4 pb-8 md:pb-0">
      {/* Back Button */}
      <div className="flex justify-start mb-4">
        <button
          onClick={onClose}
          className="p-2 bg-white dark:bg-secondary-60/50 rounded-full border border-black/5 dark:border-none hover:opacity-80 transition-opacity outline-none cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-white" />
        </button>
      </div>

      {/* Header Section */}
      <div className="flex flex-col items-center justify-center space-y-3 mb-8">
        <div className="p-3 bg-primary-95 dark:bg-primary-70/10 rounded-full">
          <Info className="w-8 h-8 text-primary-70" />
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-black dark:text-white">
            Network Information
          </h2>
          <p className="text-xs font-bold text-gray-20 dark:text-secondary-90 uppercase tracking-widest">
            Current Mode: <span className="text-primary-70">MAINNET</span>
          </p>
        </div>
      </div>

      {/* Networks List Section */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold text-gray-20 dark:text-secondary-90 uppercase tracking-[0.2em] px-1">
          Active Networks:
        </h3>

        <div className="space-y-3">
          {NETWORKS.map((network) => (
            <div
              key={network.name}
              className="flex items-center gap-4 rounded-[24px] border border-black/5 bg-white p-5 transition-all dark:border-white/10 dark:bg-secondary-60"
            >
              <div className="relative">
                <div
                  className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    network.isActive
                      ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                      : "bg-gray-400",
                  )}
                />
              </div>

              <div className="flex flex-col">
                <span className="text-sm font-bold text-black dark:text-white">
                  {network.name}
                </span>
                <span className="text-[10px] text-gray-20 dark:text-secondary-90 font-medium">
                  Chain ID: {network.chainId}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-8 pt-6 border-t border-gray-80 dark:border-secondary-40 flex items-start gap-3 px-2">
        <Activity className="w-4 h-4 text-primary-70 shrink-0 mt-0.5" />
        <p className="text-[10px] leading-relaxed text-gray-20 dark:text-secondary-90">
          All transactions are processed on the respective mainnet chains.
          Ensure you have the correct network selected for outgoing transfers.
        </p>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent className="rounded-t-[32px] border-none bg-gray-70 outline-none dark:bg-black2 [&>button]:hidden">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Network Information</DrawerTitle>
            <DrawerDescription>
              View current blockchain network status
            </DrawerDescription>
          </DrawerHeader>
          <Content />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[32px] border-none bg-gray-70 outline-none dark:bg-black2 sm:max-w-md [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Network Information</DialogTitle>
          <DialogDescription>
            View current blockchain network status
          </DialogDescription>
        </DialogHeader>
        <Content />
      </DialogContent>
    </Dialog>
  );
};

export default NetworkInformationModal;
