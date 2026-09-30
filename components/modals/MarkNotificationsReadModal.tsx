"use client";

import { Paintbrush } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MarkNotificationsReadModalProps {
  isOpen: boolean;
  isConfirming: boolean;
  onClose: (open: boolean) => void;
  onConfirm: () => void;
}

export default function MarkNotificationsReadModal({
  isOpen,
  isConfirming,
  onClose,
  onConfirm,
}: MarkNotificationsReadModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[360px] rounded-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 p-0 outline-none dark:bg-none dark:bg-black2 [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Mark all notifications as read</DialogTitle>
        </DialogHeader>

        <div className="p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-95 text-primary-50 dark:bg-primary-70/15 dark:text-primary-80">
            <Paintbrush className="h-5 w-5" />
          </div>

          <h2 className="text-lg font-semibold text-cryptoNight dark:text-white">
            Mark all as read?
          </h2>
          <p className="mx-auto mt-2 max-w-[260px] text-sm text-gray-20 dark:text-gray-40">
            This will clean up all unread notification indicators.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onClose(false)}
              disabled={isConfirming}
              className="h-11 rounded-xl border border-black/5 bg-white text-sm font-semibold text-gray-20 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-secondary-50 dark:text-gray-40 dark:hover:bg-secondary-60/50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isConfirming}
              className="h-11 rounded-xl bg-primary-50 text-sm font-semibold text-white transition-all hover:bg-primary-40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-primary-70 dark:hover:bg-primary-80 cursor-pointer"
            >
              {isConfirming ? "Marking..." : "Confirm"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
