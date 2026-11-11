"use client";

import { ChevronRight, Globe, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FlowProvider } from "@/components/modals/SelectProviderModal";
import { ProviderLogo } from "@/components/wallet/shared/ProviderLogo";

interface ProviderSelectorTriggerProps {
  selectedProvider: FlowProvider | null;
  onClick: () => void;
  isRatesLoading?: boolean;
  rateText?: string | null;
  subText?: string | null;
  disabled?: boolean;
  className?: string;
  isBestRate?: boolean;
  label?: string;
}

export function ProviderSelectorTrigger({
  selectedProvider,
  onClick,
  isRatesLoading = false,
  rateText,
  subText,
  disabled = false,
  className,
  isBestRate = false,
  label = "Payment provider",
}: ProviderSelectorTriggerProps) {
  return (
    <div className={cn("w-full", className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between rounded-2xl border border-black/5 bg-white p-2.5 text-left transition hover:border-primary-60/30 hover:shadow-xs dark:border-white/10 dark:bg-secondary-50 xs:p-3 sm:p-4",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 xs:gap-2.5 sm:gap-3">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary-60/10 to-secondary-50/10 dark:from-primary-70/10 dark:to-primary-60/10 xs:h-9 xs:w-9 sm:h-10 sm:w-10">
            {selectedProvider ? (
              <ProviderLogo
                name={selectedProvider.name}
                logo={selectedProvider.logo}
                size={36}
              />
            ) : (
              <Globe className="h-4 w-4 text-primary-60 xs:h-5 xs:w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate whitespace-nowrap text-[10px] font-light capitalize text-gray-500 dark:text-gray-400 xs:text-xs">
              {label}
            </p>
            <div className="flex items-center gap-1 xs:gap-1.5">
              <p className="truncate text-xs font-semibold text-black dark:text-white xs:text-sm">
                {selectedProvider ? selectedProvider.name : "Select provider"}
              </p>
              {isBestRate ? (
                <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 xs:px-2 xs:text-[9px]">
                  Best Rate
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 xs:gap-2">
          {isRatesLoading ? (
            <span className="flex items-center gap-1 text-[11px] text-gray-400 xs:gap-1.5 xs:text-xs">
              <Loader2 className="h-3 w-3 animate-spin text-primary-60" />
              <span>Estimating...</span>
            </span>
          ) : rateText ? (
            <div className="text-right">
              <p className="whitespace-nowrap text-[11px] font-semibold text-primary-60 xs:text-xs">
                {rateText}
              </p>
              <p className="truncate max-w-[85px] text-[9px] text-gray-500 dark:text-gray-400 xs:max-w-none xs:text-[10px]">
                {subText || selectedProvider?.deliveryTime || "Instant"}
              </p>
            </div>
          ) : (
            <span className="text-[11px] font-semibold text-primary-60 xs:text-xs">
              {selectedProvider ? "Change" : "Choose"}
            </span>
          )}
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400 xs:h-4 xs:w-4" />
        </div>
      </button>
    </div>
  );
}
