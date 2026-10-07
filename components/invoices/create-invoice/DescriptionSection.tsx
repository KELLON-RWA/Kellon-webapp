import type { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import {
  INVOICE_CARD_CLASS,
  INVOICE_INPUT_CLASS,
  type InvoiceFormValues,
} from "./types";

interface DescriptionSectionProps {
  form: UseFormReturn<InvoiceFormValues>;
}

export function DescriptionSection({ form }: DescriptionSectionProps) {
  return (
    <section className={INVOICE_CARD_CLASS}>
      <div className="mb-3">
        <h2 className="text-sm font-bold text-black dark:text-white">
          Description
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">Optional</p>
      </div>
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <textarea
                {...field}
                placeholder="What is this payment for?"
                maxLength={500}
                className={cn(
                  INVOICE_INPUT_CLASS,
                  "min-h-28 w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none transition focus-visible:ring-[3px] dark:placeholder:text-gray-400",
                )}
              />
            </FormControl>
            <FormMessage className="text-xs text-red-500" />
          </FormItem>
        )}
      />
    </section>
  );
}
