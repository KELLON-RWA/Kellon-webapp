"use client";

import * as React from "react";
import { useRouter } from "next/navigation"; // Import the router
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
import {
  Landmark,
  ArrowDownCircle,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { FC } from "react";

interface AddFundsModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
}
const AddFundsModal: FC<AddFundsModalProps> = ({
  isOpen,
  onClose,
}: AddFundsModalProps) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const router = useRouter(); // Initialize router

  const handleBankDeposit = () => {
    onClose(false);
    router.push("/buy"); // Navigate to the dedicated page
  };

  const handleCryptoDeposit = () => {
    onClose(false);
    router.push("/receive"); // Navigate to the dedicated page
  };

  const content = (
    <div className="px-4 pb-8 md:px-0 md:pb-0">
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
          Add Funds
        </h2>
        <p className="text-sm text-gray-500 dark:text-secondary-90">
          Select a top-up method
        </p>
      </div>

      <div className="space-y-4">
        <AddOption
          icon={<Landmark className="text-pink-500 w-6 h-6" />}
          title="Bank & Card Deposit"
          description="Instant bank transfer or card payment."
          onClick={handleBankDeposit} // Trigger the navigation
        />
        <AddOption
          icon={<ArrowDownCircle className="text-green-500 w-6 h-6" />}
          title="Deposit Crypto"
          description="Only deposit supported stablecoins: USDC or USDT."
          onClick={handleCryptoDeposit}
        />
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px] bg-gray-70 dark:bg-black2 border-none rounded-[32px] outline-none [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Add Funds</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="bg-gray-70 dark:bg-black2 border-none rounded-t-[32px] outline-none [&>button]:hidden">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Add Funds</DrawerTitle>
        </DrawerHeader>
        {content}
      </DrawerContent>
    </Drawer>
  );
};

function AddOption({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between w-full p-5 bg-white dark:bg-secondary-60 hover:bg-gray-50 dark:hover:bg-secondary-60/50 border border-black/5 dark:border-white/10 rounded-[24px] transition-all group outline-none cursor-pointer"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-white dark:bg-white/5 flex items-center justify-center border border-black/5 dark:border-white/5">
          {icon}
        </div>
        <div className="text-left">
          <p className="font-bold text-sm text-black dark:text-white">
            {title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
    </button>
  );
}

export default AddFundsModal;
