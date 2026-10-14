"use client";

import { useState } from "react";
import { ChevronRight, IdCard } from "lucide-react";
import { useKyc } from "@/hooks/use-kyc";
import { KycDialog } from "./KycDialog";

export function IdentityDetailsCard() {
  const [isOpen, setIsOpen] = useState(false);
  const { profile, isLoading, refresh } = useKyc();
  const summary = isLoading
    ? "Loading..."
    : profile?.fullName && profile.documents.length
      ? `${profile.fullName} · ${profile.documents.length} ID on file`
      : "Not added yet";

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group flex w-full cursor-pointer items-center justify-between rounded-[24px] border border-slate-100 bg-white p-5 transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-50 dark:hover:bg-secondary-60/50"
      >
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-slate-100 p-3 text-primary-70 dark:bg-[#1a1f2e]">
            <IdCard className="h-6 w-6" />
          </div>
          <div className="text-left">
            <h4 className="font-semibold text-slate-900 dark:text-white">
              Identity Details
            </h4>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              {summary}
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-400" />
      </button>
      <KycDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        onSaved={() => refresh().catch(() => {})}
      />
    </>
  );
}
