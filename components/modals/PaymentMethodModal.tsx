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
import {
  CreditCard,
  Landmark,
  Smartphone,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentMethod = "card" | "bank" | "mobile_money";

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  selectedMethod: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
}

const METHODS = [
  {
    id: "card" as const,
    title: "Debit/Credit Card",
    icon: <CreditCard className="w-5 h-5 text-blue-500" />,
  },
  {
    id: "bank" as const,
    title: "Bank Transfer",
    icon: <Landmark className="w-5 h-5 text-pink-500" />,
  },
  {
    id: "mobile_money" as const,
    title: "Mobile Money",
    icon: <Smartphone className="w-5 h-5 text-orange-500" />,
  },
];

export default function PaymentMethodModal({
  isOpen,
  onClose,
  selectedMethod,
  onSelect,
}: PaymentMethodModalProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const content = (
    <div className="px-4 pb-8 md:px-0 md:pb-6">
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
          Select Payment Method
        </h2>
      </div>

      <div className="space-y-3">
        {METHODS.map((method) => {
          const isSelected = selectedMethod === method.id;
          return (
            <button
              key={method.id}
              onClick={() => {
                onSelect(method.id);
                onClose(false);
              }}
              className={cn(
                "w-full flex items-center justify-between p-5 rounded-[24px] border transition-all group outline-none cursor-pointer",
                isSelected
                  ? "border-primary-70 bg-primary-70/5 dark:bg-primary-70/10"
                  : "border-black/5 bg-white hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-60 dark:hover:bg-secondary-60/50",
              )}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-white/5 flex items-center justify-center border border-black/5 dark:border-white/5">
                  {method.icon}
                </div>
                <span
                  className={cn(
                    "font-bold text-sm",
                    isSelected
                      ? "text-primary-70"
                      : "text-black dark:text-white",
                  )}
                >
                  {method.title}
                </span>
              </div>
              {isSelected && (
                <CheckCircle2 className="w-5 h-5 text-primary-70" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[400px] bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 dark:bg-none dark:bg-black2 border-none rounded-[32px] outline-none [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Select Payment Method</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 dark:bg-none dark:bg-black2 border-none rounded-t-[32px] outline-none [&>button]:hidden">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Select Payment Method</DrawerTitle>
        </DrawerHeader>
        {content}
      </DrawerContent>
    </Drawer>
  );
}
