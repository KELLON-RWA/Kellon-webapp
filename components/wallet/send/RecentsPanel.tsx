"use client";

import { ChevronRight } from "lucide-react";
import FlowEmptyState from "@/components/wallet/shared/FlowEmptyState";
import type { RecentRecipient } from "./send-types";
import {
  getRecipientIcon,
  getRecipientKind,
  truncateMiddle,
} from "./send-utils";

interface RecentsPanelProps {
  recentRecipients: RecentRecipient[];
  onSelectRecipient: (value: string) => void;
}

export default function RecentsPanel({
  recentRecipients,
  onSelectRecipient,
}: RecentsPanelProps) {
  return (
    <aside className="w-full min-w-0 overflow-hidden rounded-[24px] border border-black/5 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-secondary-50/80 dark:shadow-none md:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-black dark:text-white">
          Recents
        </h2>
        <span className="text-[10px] font-bold uppercase tracking-tight text-gray-30 dark:text-gray-40">
          Transfer methods
        </span>
      </div>

      <div className="grid gap-3">
        {recentRecipients.length > 0 ? (
          recentRecipients.map((recipient) => {
            const kind = getRecipientKind(recipient.value);
            const Icon = getRecipientIcon(kind);

            return (
              <button
                key={recipient.value}
                type="button"
                onClick={() => onSelectRecipient(recipient.value)}
                className="flex items-center justify-between gap-3 rounded-2xl border border-gray-80 bg-white p-3 text-left transition hover:border-primary-90 hover:bg-primary-99 dark:border-white/10 dark:bg-secondary-60/25 dark:hover:border-primary-70/30 dark:hover:bg-primary-70/10 cursor-pointer"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-95 text-primary-50 dark:bg-primary-70/15 dark:text-primary-80">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-black dark:text-white">
                      {truncateMiddle(recipient.value, 10)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-20 dark:text-gray-40">
                      {recipient.method}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-30" />
              </button>
            );
          })
        ) : (
          <FlowEmptyState
            className="p-5"
            title="No recent recipients"
            titleClassName="mb-0 text-sm text-black dark:text-white"
            text="People you send to will appear here."
            textClassName="mt-1 text-xs text-gray-20 dark:text-gray-40 md:text-xs"
          />
        )}
      </div>
    </aside>
  );
}
