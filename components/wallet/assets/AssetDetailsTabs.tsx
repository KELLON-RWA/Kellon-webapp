"use client";

import { cn } from "@/lib/utils";
import type { ChainBalance } from "./asset-details-utils";

interface AssetDetailsTabsProps {
  activeTab: string;
  chainBalances: ChainBalance[];
  onChange: (tab: string) => void;
}

export function AssetDetailsTabs({
  activeTab,
  chainBalances,
  onChange,
}: AssetDetailsTabsProps) {
  return (
    <nav className="-mx-4 border-b border-black/5 dark:border-white/10 md:mx-0">
      <div className="flex gap-1 overflow-x-auto px-4 md:px-0">
        {[
          { id: "overview", label: "Overview" },
          ...chainBalances.map((item) => ({
            id: item.chain,
            label: item.label,
          })),
        ].map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "cursor-pointer whitespace-nowrap border-b-2 px-3 pb-3 text-sm font-semibold transition",
                isActive
                  ? "border-primary-60 text-primary-60 dark:text-primary-80"
                  : "border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
