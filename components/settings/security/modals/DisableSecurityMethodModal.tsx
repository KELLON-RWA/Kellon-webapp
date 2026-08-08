"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { DisableSecurityAction } from "../security-types";

interface DisableSecurityMethodModalProps {
  action: DisableSecurityAction;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DisableSecurityMethodModal({
  action,
  isBusy,
  onClose,
  onConfirm,
}: DisableSecurityMethodModalProps) {
  return (
    <AlertDialog
      open={action !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-[28px] border border-black/5 bg-white p-6 outline-none dark:border-white/10 dark:bg-black2">
        <AlertDialogHeader className="!place-items-center !text-center sm:!place-items-center sm:!text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <TriangleAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <AlertDialogTitle className="w-full text-center text-lg font-semibold text-cryptoNight dark:text-white">
            Disable {action?.label}?
          </AlertDialogTitle>
          <AlertDialogDescription className="mx-auto max-w-xs text-center text-sm leading-6 text-gray-20 dark:text-gray-40">
            You will no longer be able to use this method to approve sensitive
            actions. You can enable it again from Security &amp; Backup.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2 grid grid-cols-2 gap-3 sm:grid">
          <AlertDialogCancel
            disabled={isBusy}
            className="h-12 cursor-pointer rounded-xl border-black/10 bg-white font-semibold text-cryptoNight hover:bg-gray-95 dark:border-white/10 dark:bg-secondary-50 dark:text-white dark:hover:bg-secondary-60"
          >
            Keep enabled
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
            disabled={isBusy}
            className="h-12 cursor-pointer rounded-xl border-none bg-red-600 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed"
          >
            {isBusy ? (
              <Loader2
                className="h-5 w-5 animate-spin"
                aria-label="Disabling"
              />
            ) : (
              "Disable"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
