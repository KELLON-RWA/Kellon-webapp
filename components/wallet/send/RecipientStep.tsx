"use client";

import { Search } from "lucide-react";
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
import { getRecipientPendingLabel, truncateMiddle } from "./send-utils";

interface RecipientStepProps {
  recipientForm: UseFormReturn<RecipientFormValues>;
  recipientInput: string;
  recipientKind: RecipientKind;
  isRecipientValid: boolean;
  selfRecipientError: string | null;
  verifiedRecipient: VerifiedRecipient | null;
  isVerifyingRecipient: boolean;
  recipientLookupMessage: string;
  onVerifyRecipient: (values: RecipientFormValues) => void | Promise<void>;
  onRecipientChange: (value: string) => void;
}

export default function RecipientStep({
  recipientForm,
  recipientInput,
  recipientKind,
  isRecipientValid,
  selfRecipientError,
  verifiedRecipient,
  isVerifyingRecipient,
  recipientLookupMessage,
  onVerifyRecipient,
  onRecipientChange,
}: RecipientStepProps) {
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
        <div
          className={cn(
            "rounded-2xl border p-4",
            selfRecipientError
              ? "border-red-200 bg-red-50 dark:border-red-500/25 dark:bg-red-500/10"
              : verifiedRecipient
                ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/25 dark:bg-emerald-500/10"
                : isRecipientValid
                  ? "border-primary-90 bg-primary-99 dark:border-primary-70/30 dark:bg-primary-70/10"
                  : "border-gray-80 bg-gray-95 dark:border-white/10 dark:bg-secondary-60/35",
          )}
        >
          <div className="flex items-start gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-black dark:text-white">
                {selfRecipientError
                  ? "You can't send to yourself"
                  : isVerifyingRecipient
                    ? "Checking Kellon user"
                    : isRecipientValid
                      ? verifiedRecipient
                        ? "Recipient verified"
                        : getRecipientPendingLabel(recipientKind)
                      : "Check recipient"}
              </p>
              <p className="mt-1 break-all text-xs text-gray-20 dark:text-gray-40 md:text-sm">
                {selfRecipientError
                  ? selfRecipientError
                  : recipientLookupMessage
                    ? recipientLookupMessage
                    : isRecipientValid
                      ? truncateMiddle(recipientInput.trim(), 12)
                      : "Enter a valid email, username, @tag, EVM address, or Stellar address."}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
