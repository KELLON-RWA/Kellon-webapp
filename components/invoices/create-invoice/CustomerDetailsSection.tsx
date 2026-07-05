import type { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TransferRecipient } from "@/services/api/transfers";
import {
  INVOICE_CARD_CLASS,
  INVOICE_INPUT_CLASS,
  type InvoiceFormValues,
} from "./types";

interface CustomerDetailsSectionProps {
  form: UseFormReturn<InvoiceFormValues>;
  customerLookupMessage: string;
  verifiedCustomer: TransferRecipient | null;
  isVerifyingCustomer: boolean;
}

export function CustomerDetailsSection({
  form,
  customerLookupMessage,
  verifiedCustomer,
  isVerifyingCustomer,
}: CustomerDetailsSectionProps) {
  return (
    <section className={INVOICE_CARD_CLASS}>
      <div className="mb-4">
        <h2 className="text-sm font-bold text-black dark:text-white">
          Customer Details
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          The customer must be a Kellon user.
        </p>
      </div>
      <div className="space-y-4">
        <FormField
          control={form.control}
          name="customerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                Name
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="Customer name"
                  className={cn(INVOICE_INPUT_CLASS, "h-12 rounded-2xl")}
                />
              </FormControl>
              <FormMessage className="text-xs text-red-500" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="customerContact"
          render={({ field, fieldState }) => {
            const showLookupMessage =
              Boolean(customerLookupMessage) && !fieldState.error;

            return (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Email or Kellon Tag
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="customer@email.com or @username"
                    className={cn(INVOICE_INPUT_CLASS, "h-12 rounded-2xl")}
                  />
                </FormControl>
                {showLookupMessage ? (
                  <p
                    className={cn(
                      "text-xs font-medium",
                      verifiedCustomer?.found
                        ? "text-emerald-600 dark:text-emerald-400"
                        : isVerifyingCustomer
                          ? "text-gray-500 dark:text-gray-400"
                          : "text-red-500",
                    )}
                  >
                    {customerLookupMessage}
                  </p>
                ) : null}
                <FormMessage className="text-xs text-red-500" />
              </FormItem>
            );
          }}
        />
      </div>
    </section>
  );
}
