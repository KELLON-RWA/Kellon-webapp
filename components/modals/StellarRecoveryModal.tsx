"use client";

import { FC, useState, useEffect } from "react";
import {
  Key,
  Copy,
  AlertTriangle,
  Eye,
  EyeOff,
  Info,
  ArrowLeft,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/use-media-query";

interface StellarKeyRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  secretKey?: string;
}

const StellarKeyRecoveryModal: FC<StellarKeyRecoveryModalProps> = ({
  isOpen,
  onClose,
  secretKey = "SAOPI...EXAMPLE...KEY...12345",
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        document.body.style.pointerEvents = "auto";
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const copyToClipboard = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(secretKey);
      toast.success("Secret key copied t clipboard");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      toast.error("Failed to copy key");
    }
  };

  const Content = () => (
    <div className="px-4 pb-8 md:pb-0">
      {/* Custom Back/Close Button */}
      <div className="flex justify-start mb-4">
        <button
          onClick={onClose}
          className="p-2 bg-white dark:bg-secondary-60/50 rounded-full border border-black/5 dark:border-none hover:opacity-80 transition-opacity outline-none cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-white" />
        </button>
      </div>

      <div className="flex flex-col items-center justify-center space-y-3 mb-6">
        <div className="p-3 bg-primary-95 dark:bg-primary-70/10 rounded-full">
          <Key className="w-8 h-8 text-primary-70" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-black dark:text-white">
            Recovery Key
          </h2>
          <p className="text-sm text-gray-20 dark:text-secondary-90 max-w-[280px] mx-auto">
            Your recovery key (Secret Seed) is the only way to recover your
            account if you lose access to this device.
          </p>
        </div>
      </div>

      <div className="relative group overflow-hidden bg-white dark:bg-secondary-60 border border-black/5 dark:border-white/10 rounded-[24px] p-6 min-h-[140px] flex flex-col items-center justify-center">
        {!isRevealed ? (
          <button
            onClick={() => setIsRevealed(true)}
            className="flex flex-col items-center gap-2 text-primary-70 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <span className="text-2xl tracking-widest font-bold">
              ••••••••••••
            </span>
            <span className="text-sm font-bold flex items-center gap-2">
              <Eye className="w-4 h-4" /> Reveal Key
            </span>
          </button>
        ) : (
          <div className="w-full space-y-4 animate-in fade-in zoom-in duration-300">
            <p className="text-sm font-mono break-all text-center text-black dark:text-white px-2">
              {secretKey}
            </p>
            <div className="flex justify-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsRevealed(false)}
                className="text-xs"
              >
                <EyeOff className="w-3 h-3 mr-1" /> Hide
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={copyToClipboard}
                className="text-xs text-primary-70 cursor-copy"
              >
                <Copy className="w-3 h-3 mr-1" /> Copy
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-start gap-3 justify-center text-orange-600 dark:text-orange-400">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="text-xs font-medium">
          Store this key in a safe, offline location.
        </p>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-80 dark:border-secondary-40 text-center">
        <div className="flex items-center justify-center gap-2 mb-4 text-gray-20 dark:text-secondary-90">
          <Info className="w-4 h-4" />
          <p className="text-[10px] max-w-[240px]">
            For Smart Accounts (ERC-4337), please use the Social Recovery
            dashboard in settings to manage your guardians and recover your
            account.
          </p>
        </div>
        <Button
          onClick={onClose}
          className="w-full bg-primary-70 hover:bg-primary-70/90 text-white font-bold py-6 rounded-xl"
        >
          I&apos;ve saved it securely
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={onClose}>
        <DrawerContent className="rounded-t-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 outline-none dark:bg-none dark:bg-black2 [&>button]:hidden">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Stellar Key Recovery</DrawerTitle>
            <DrawerDescription>
              View and save your recovery seed phrase.
            </DrawerDescription>
          </DrawerHeader>
          <Content />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 outline-none dark:bg-none dark:bg-black2 sm:max-w-md [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Stellar Key Recovery</DialogTitle>
          <DialogDescription>
            View and save your recovery seed phrase.
          </DialogDescription>
        </DialogHeader>
        <Content />
      </DialogContent>
    </Dialog>
  );
};

export default StellarKeyRecoveryModal;
