"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import type { DisableSecurityAction } from "../security-types";

interface DisableSecurityMethodModalProps {
  action: DisableSecurityAction;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: (code: string) => Promise<void>;
  onRequestCode: () => Promise<void>;
}

export default function DisableSecurityMethodModal({
  action,
  isBusy,
  onClose,
  onConfirm,
  onRequestCode,
}: DisableSecurityMethodModalProps) {
  const [code, setCode] = useState("");
  const requiresSentCode = action?.kind === "otp";

  useEffect(() => {
    setCode("");
  }, [action]);

  const description =
    action?.kind === "totp"
      ? "Enter the current code from your authenticator app to continue."
      : action?.kind === "biometrics"
        ? "Enter a current verification code to continue."
        : "Enter a verification code sent to this method to continue.";

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
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <label htmlFor="disable-security-code" className="sr-only">
            Verification code
          </label>
          <Input
            id="disable-security-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Enter verification code"
            disabled={isBusy}
            className="h-12 rounded-xl text-center text-sm"
          />
          {requiresSentCode ? (
            <button
              type="button"
              onClick={() => void onRequestCode()}
              disabled={isBusy}
              className="text-xs font-medium text-primary-50 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-70"
            >
              Send verification code
            </button>
          ) : null}
        </div>
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
              void onConfirm(code);
            }}
            disabled={isBusy || code.trim().length < 4}
            className="h-12 cursor-pointer rounded-xl border-none bg-red-600 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed"
          >
            {isBusy ? (
              <Loader2
                className="h-5 w-5 animate-spin"
                aria-label="Disabling"
              />
            ) : (
              "Verify & disable"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
