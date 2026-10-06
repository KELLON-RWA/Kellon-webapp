"use client";

import { useEffect, useRef } from "react";
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
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    const tabList = tabListRef.current;
    const activeTabElement = tabRefs.current.get(activeTab);

    if (!tabList || !activeTabElement) return;

    const padding = 16;
    const tabLeft = activeTabElement.offsetLeft;
    const tabRight = tabLeft + activeTabElement.offsetWidth;
    const visibleLeft = tabList.scrollLeft + padding;
    const visibleRight = tabList.scrollLeft + tabList.clientWidth - padding;

    if (tabLeft < visibleLeft) {
      tabList.scrollTo({
        left: Math.max(0, tabLeft - padding),
        behavior: "smooth",
      });
    } else if (tabRight > visibleRight) {
      tabList.scrollTo({
        left: tabRight - tabList.clientWidth + padding,
        behavior: "smooth",
      });
    }
  }, [activeTab]);

  return (
    <nav className="-mx-4 border-b border-black/5 dark:border-white/10 md:mx-0">
      <div ref={tabListRef} className="flex gap-1 overflow-x-auto px-4 md:px-0">
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
              ref={(element) => {
                if (element) tabRefs.current.set(tab.id, element);
                else tabRefs.current.delete(tab.id);
              }}
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
