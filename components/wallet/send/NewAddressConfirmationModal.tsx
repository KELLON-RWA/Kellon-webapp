"use client";

import * as React from "react";
import { AlertTriangle, ArrowLeft, ArrowRight } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
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

interface NewAddressConfirmationModalProps {
  isOpen: boolean;
  address: string;
  networkLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function NewAddressConfirmationModal({
  isOpen,
  address,
  networkLabel,
  onCancel,
  onConfirm,
}: NewAddressConfirmationModalProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const content = (
    <div className="px-4 pb-8 md:px-0 md:pb-0">
      <div className="mb-4 flex justify-start">
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded-full border border-black/5 bg-white p-2 outline-none transition-opacity hover:opacity-80 dark:border-none dark:bg-secondary-60/50"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-white" />
        </button>
      </div>

      <div className="mb-2 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-500">
          <AlertTriangle className="h-7 w-7 stroke-[2.2]" />
        </div>
        <h2 className="text-xl font-bold text-black dark:text-white">
          Confirm Address
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-secondary-90">
          Make sure this address is correct before you continue
        </p>
      </div>

      <div className="mt-5 rounded-[24px] border border-black/5 bg-white p-4 text-center dark:border-white/10 dark:bg-secondary-60">
        {networkLabel ? (
          <p className="mb-1 text-[11px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-400">
            {networkLabel}
          </p>
        ) : null}
        <p className="select-all break-all font-mono text-xs font-bold leading-relaxed text-black dark:text-white md:text-sm">
          {address}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="flowSecondary"
          onClick={onCancel}
          className="h-12 w-full cursor-pointer rounded-2xl text-sm font-semibold"
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="flow"
          onClick={onConfirm}
          className="h-12 w-full cursor-pointer rounded-2xl"
        >
          <span className="relative z-10 flex items-center justify-center gap-2 text-sm font-bold">
            Continue
            <ArrowRight className="h-4 w-4" />
          </span>
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
        </Button>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
        <DialogContent className="rounded-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 p-6 outline-none sm:max-w-[425px] dark:bg-black2 dark:bg-none [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Confirm Address</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DrawerContent className="rounded-t-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 outline-none dark:bg-black2 dark:bg-none [&>button]:hidden">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Confirm Address</DrawerTitle>
        </DrawerHeader>
        {content}
      </DrawerContent>
    </Drawer>
  );
}
