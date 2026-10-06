"use client";

import { useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { ChainBalance } from "./asset-details-utils";

interface AssetDetailsTabsProps {
  activeTab: string;
  pendingTab?: string | null;
  chainBalances: ChainBalance[];
  onChange: (tab: string) => void;
}

export function AssetDetailsTabs({
  activeTab,
  pendingTab,
  chainBalances,
  onChange,
}: AssetDetailsTabsProps) {
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  // Keep the selected network visible before the page paints its new state so
  // the tab strip moves in lockstep with the completed swipe.
  useLayoutEffect(() => {
    const tabList = tabListRef.current;
    const visibleTab = pendingTab || activeTab;
    const activeTabElement = tabRefs.current.get(visibleTab);

    if (!tabList || !activeTabElement) return;

    const padding = 16;
    const listBounds = tabList.getBoundingClientRect();
    const tabBounds = activeTabElement.getBoundingClientRect();
    const visibleLeft = listBounds.left + padding;
    const visibleRight = listBounds.right - padding;

    if (tabBounds.left < visibleLeft) {
      tabList.scrollLeft += tabBounds.left - visibleLeft;
    } else if (tabBounds.right > visibleRight) {
      tabList.scrollLeft += tabBounds.right - visibleRight;
    }
  }, [activeTab, pendingTab]);

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
