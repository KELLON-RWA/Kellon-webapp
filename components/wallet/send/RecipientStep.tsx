"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Search,
  Wallet,
} from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import type {
  RecipientFormValues,
  RecipientKind,
  VerifiedRecipient,
} from "./send-types";
import {
  getRecipientInitials,
  getRecipientLabel,
  getRecipientPendingLabel,
  truncateMiddle,
} from "./send-utils";

interface RecipientStepProps {
  recipientForm: UseFormReturn<RecipientFormValues>;
  recipientInput: string;
  recipientKind: RecipientKind;
  isRecipientValid: boolean;
  selfRecipientError: string | null;
  verifiedRecipient: VerifiedRecipient | null;
  candidateRecipient: VerifiedRecipient | null;
  isRecipientConfirmed: boolean;
  isVerifyingRecipient: boolean;
  recipientLookupMessage: string;
  onVerifyRecipient: (values: RecipientFormValues) => void | Promise<void>;
  onConfirmRecipient: (recipient?: VerifiedRecipient | null) => void;
  onResetConfirmation?: () => void;
  onRecipientChange: (value: string) => void;
}

export default function RecipientStep({
  recipientForm,
  recipientInput,
  recipientKind,
  isRecipientValid,
  selfRecipientError,
  verifiedRecipient,
  candidateRecipient,
  isRecipientConfirmed,
  isVerifyingRecipient,
  recipientLookupMessage,
  onVerifyRecipient,
  onConfirmRecipient,
  onResetConfirmation,
  onRecipientChange,
}: RecipientStepProps) {
  const isWalletAddress =
    recipientKind === "evm" ||
    recipientKind === "solana" ||
    recipientKind === "stellar";

  const resolvedRecipient = verifiedRecipient || candidateRecipient;

  return (
    <div className="flex h-full flex-col gap-6">
      <Form {...recipientForm}>
        <form onSubmit={recipientForm.handleSubmit(onVerifyRecipient)}>
          <FormField
            control={recipientForm.control}
            name="recipient"
            render={({ field }) => (
              <FormItem>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-50" />
                  <FormControl>
                    <Input
                      id="send-recipient"
                      type="text"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      maxLength={254}
                      placeholder="email address, @kellonTag, or wallet address"
                      className="h-12 rounded-2xl border-black/5 bg-gray-95 pl-11 text-sm font-medium shadow-none placeholder:text-xs placeholder:text-gray-400 focus-visible:ring-primary-70/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white md:h-[52px] md:rounded-2xl md:placeholder:text-sm"
                      {...field}
                      onChange={(event) => {
                        field.onChange(event);
                        onRecipientChange(event.target.value);
                      }}
                    />
                  </FormControl>
                </div>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />
        </form>
      </Form>

      {recipientInput.trim() ? (
        <div className="w-full">
          {selfRecipientError ? (
            <div className="flex items-start gap-3.5 rounded-2xl border border-red-500/25 bg-red-50 p-4 dark:border-red-500/25 dark:bg-red-500/10">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                  You can&apos;t send to yourself
                </p>
                <p className="mt-0.5 text-xs text-red-700/90 dark:text-red-300/90">
                  {selfRecipientError}
                </p>
              </div>
            </div>
          ) : isVerifyingRecipient ? (
            <div className="flex items-center gap-3.5 rounded-2xl border border-black/5 bg-gray-95 p-4 animate-pulse dark:border-white/10 dark:bg-secondary-60/35">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50/15 text-primary-50 dark:bg-primary-50/20 dark:text-primary-40">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-black dark:text-white">
                  Checking account...
                </p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Searching for Kellon user
                </p>
              </div>
            </div>
          ) : recipientLookupMessage && !resolvedRecipient ? (
            <div className="flex items-start gap-3.5 rounded-2xl border border-amber-500/25 bg-amber-50 p-4 dark:border-amber-500/25 dark:bg-amber-500/10">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  No user found
                </p>
                <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-300/90">
                  {recipientLookupMessage}
                </p>
              </div>
            </div>
          ) : resolvedRecipient ? (
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                {isRecipientConfirmed ? "Selected recipient" : "Matching account"}
              </p>
              <button
                type="button"
                onClick={() => onConfirmRecipient(resolvedRecipient)}
                className={cn(
                  "group flex w-full cursor-pointer items-center justify-between gap-3.5 rounded-2xl border p-4 text-left transition-all",
                  isRecipientConfirmed
                    ? "border-primary-60 bg-primary-70/5 ring-2 ring-primary-60/20"
                    : "border-black/5 bg-white hover:border-primary-60/40 hover:bg-gray-50/80 active:scale-[0.99] dark:border-white/10 dark:bg-secondary-50 dark:hover:bg-secondary-60/50",
                )}
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors",
                      isRecipientConfirmed
                        ? "bg-primary-50 text-white shadow-sm dark:bg-primary-60"
                        : "bg-primary-95 text-primary-50 dark:bg-primary-70/15 dark:text-primary-80",
                    )}
                  >
                    {isWalletAddress ? (
                      <Wallet className="h-5 w-5" />
                    ) : (
                      getRecipientInitials(
                        resolvedRecipient.name,
                        resolvedRecipient.identifier,
                      )
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-black capitalize dark:text-white">
                      {resolvedRecipient.name ||
                        (isWalletAddress
                          ? getRecipientLabel(recipientKind)
                          : resolvedRecipient.identifier)}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 truncate text-xs text-gray-500 dark:text-gray-400 font-mono">
                      <span>
                        {isWalletAddress
                          ? truncateMiddle(resolvedRecipient.identifier, 10)
                          : resolvedRecipient.identifier}
                      </span>
                      <span>•</span>
                      <span className="font-sans font-medium">
                        {isWalletAddress ? "Wallet" : "Kellon user"}
                      </span>
                    </div>
                  </div>
                </div>

                {isRecipientConfirmed ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary-60" />
                ) : (
                  <ChevronRight className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-60" />
                )}
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-80 bg-gray-95 p-4 dark:border-white/10 dark:bg-secondary-60/35">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-black dark:text-white">
                  {isRecipientValid
                    ? getRecipientPendingLabel(recipientKind)
                    : "Check recipient"}
                </p>
                <p className="mt-1 break-all text-xs text-gray-20 dark:text-gray-40 md:text-sm">
                  {isRecipientValid
                    ? truncateMiddle(recipientInput.trim(), 12)
                    : "Enter a valid email, username, @tag, EVM address, Solana address, or Stellar address."}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
