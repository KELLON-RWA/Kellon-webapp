import type { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ChainIcon from "@/components/wallet/ChainIcon";
import { getChainLabel } from "@/lib/chains";
import { cn } from "@/lib/utils";
import { AssetChoice } from "./AssetChoice";
import {
  INVOICE_CARD_CLASS,
  INVOICE_INPUT_CLASS,
  type InvoiceAssetGroup,
  type InvoiceAssetOption,
  type InvoiceFormValues,
} from "./types";

interface AmountSectionProps {
  form: UseFormReturn<InvoiceFormValues>;
  assetGroups: InvoiceAssetGroup[];
  selectedAssetGroup?: InvoiceAssetGroup;
  selectedAsset?: InvoiceAssetOption;
}

export function AmountSection({
  form,
  assetGroups,
  selectedAssetGroup,
  selectedAsset,
}: AmountSectionProps) {
  return (
    <section className={INVOICE_CARD_CLASS}>
      <h2 className="mb-3 text-sm font-bold text-black dark:text-white">
        Amount
      </h2>
      <div className="space-y-3">
        <FormField
          control={form.control}
          name="assetSymbol"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {assetGroups.map((asset) => (
                    <AssetChoice
                      key={asset.symbol}
                      asset={asset}
                      selected={field.value === asset.symbol}
                      onClick={() => field.onChange(asset.symbol)}
                    />
                  ))}
                </div>
              </FormControl>
              <FormMessage className="text-xs text-red-500" />
            </FormItem>
          )}
        />

        {selectedAssetGroup ? (
          <FormField
            control={form.control}
            name="chain"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  Network
                </FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      aria-label={`Select ${selectedAssetGroup.symbol} network`}
                      className="h-14 w-full rounded-2xl border-black/5 bg-gray-95 px-3 text-black shadow-none focus:border-primary-60 focus:ring-2 focus:ring-primary-60/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white"
                    >
                      {selectedAsset ? (
                        <span className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                            <ChainIcon
                              name={selectedAsset.chain}
                              size={28}
                              className="!h-7 !w-7 shrink-0"
                            />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                            {getChainLabel(selectedAsset.chain)}
                          </span>
                        </span>
                      ) : (
                        <SelectValue placeholder="Choose network" />
                      )}
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-black/10 bg-white p-1.5 text-black shadow-xl dark:border-white/10 dark:bg-secondary-50 dark:text-white">
                      {selectedAssetGroup.chains.map((asset) => (
                        <SelectItem
                          key={asset.key}
                          value={asset.chain}
                          className="min-h-14 rounded-xl py-2.5 pl-3 pr-3 focus:bg-gray-50 dark:focus:bg-secondary-60/50 [&>span:first-child]:hidden [&>span:last-child]:min-w-0 [&>span:last-child]:flex-1"
                        >
                          <span className="flex w-full min-w-0 items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                              <ChainIcon
                                name={asset.chain}
                                size={28}
                                className="!h-7 !w-7 shrink-0"
                              />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                              {getChainLabel(asset.chain)}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage className="text-xs text-red-500" />
              </FormItem>
            )}
          />
        ) : null}

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="relative">
                  <Input
                    {...field}
                    inputMode="decimal"
                    placeholder="0.00"
                    className={cn(
                      INVOICE_INPUT_CLASS,
                      "h-16 rounded-2xl pr-20 text-2xl font-semibold",
                    )}
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500 dark:text-gray-400">
                    {selectedAsset?.symbol || "Asset"}
                  </span>
                </div>
              </FormControl>
              <FormMessage className="text-xs text-red-500" />
            </FormItem>
          )}
        />
      </div>
    </section>
  );
}
