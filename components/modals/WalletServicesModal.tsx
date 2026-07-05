"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, FileText, Gift, MoreHorizontal, X } from "lucide-react";
import { toast } from "sonner";
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
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

interface WalletServicesModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
}

export default function WalletServicesModal({
  isOpen,
  onClose,
}: WalletServicesModalProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const router = useRouter();

  const handleComingSoon = (label: string) => {
    toast.info(`${label} is coming soon`);
  };

  const handlePaymentRequests = () => {
    onClose(false);
    router.push("/invoices");
  };

  const handleSendGift = () => {
    onClose(false);
    router.push("/gifts");
  };

  const content = (
    <div className="px-4 pb-8 md:px-0 md:pb-0">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-black dark:text-white">
            Wallet Services
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-secondary-90">
            Explore the Kellon ecosystem
          </p>
        </div>

        <button
          type="button"
          onClick={() => onClose(false)}
          className="rounded-full border border-black/5 bg-white p-2 text-slate-600 outline-none transition-opacity hover:opacity-80 dark:border-none dark:bg-secondary-60/50 dark:text-white cursor-pointer"
          aria-label="Close wallet services"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-4">
        <ServiceOption
          icon={<FileText className="h-6 w-6 text-pink-500" />}
          title="Payment Requests"
          description="Create and manage invoices"
          onClick={handlePaymentRequests}
        />
        <ServiceOption
          icon={<Gift className="h-6 w-6 text-pink-500" />}
          title="Send Gift"
          description="Send crypto gifts to friends"
          onClick={handleSendGift}
        />
        <ServiceOption
          icon={<MoreHorizontal className="h-6 w-6 text-gray-400" />}
          title="More Coming Soon"
          description="Stay tuned for new features"
          onClick={() => handleComingSoon("More services")}
          muted
        />
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px] bg-gray-70 dark:bg-black2 border-none rounded-[32px] outline-none [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Wallet Services</DialogTitle>
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
          <DrawerTitle>Wallet Services</DrawerTitle>
        </DrawerHeader>
        {content}
      </DrawerContent>
    </Drawer>
  );
}

function ServiceOption({
  icon,
  title,
  description,
  onClick,
  muted,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded-[24px] border border-black/5 bg-white p-5 text-left outline-none transition-all group dark:border-white/10 dark:bg-secondary-60 cursor-pointer",
        "hover:bg-gray-50 dark:hover:bg-secondary-60/50",
        muted && "opacity-75",
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white dark:border-white/5 dark:bg-white/5",
            muted && "bg-gray-95 dark:bg-white/5",
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-black dark:text-white">
            {title}
          </p>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-gray-400 transition-colors group-hover:text-black dark:group-hover:text-white" />
    </button>
  );
}
