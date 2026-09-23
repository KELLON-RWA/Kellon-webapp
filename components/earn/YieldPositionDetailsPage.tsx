"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowLeft, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import AssetNetworkIcon from "@/components/wallet/AssetNetworkIcon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { yieldService } from "@/services/api/yield";
import type { User } from "@/types/db";
import EarnActionDialog from "./EarnActionDialog";
import {
  formatApy,
  formatTokenAmount,
  getPositionOpportunity,
  getPositionValue,
  getProtocolName,
} from "./earn-utils";

function PositionMetric({ label, value, tone }: { label: string; value: string; tone?: "positive" }) {
  return (
    <div className="min-w-0 rounded-xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
      <p className="text-xs text-gray-30 dark:text-gray-40">{label}</p>
      <p className={cn("mt-2 truncate text-base font-semibold tabular-nums text-cryptoNight dark:text-white", tone === "positive" && "text-emerald-600 dark:text-emerald-300")}>
        {value}
      </p>
    </div>
  );
}

export default function YieldPositionDetailsPage({
  profile,
  positionId,
}: {
  profile: User;
  positionId: string;
}) {
  const router = useRouter();
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const { data: positions = [], isLoading: positionsLoading, refetch: refetchPositions } = useQuery({
    queryKey: ["yield-positions"],
    queryFn: async () => (await yieldService.getPositions()).data,
    staleTime: 30_000,
  });
  const { data: opportunities = [], refetch: refetchOpportunities } = useQuery({
    queryKey: ["yield-opportunities"],
    queryFn: async () => (await yieldService.getOpportunities()).data,
    staleTime: 60_000,
  });
  const position = useMemo(
    () => positions.find((item) => item.id === positionId) || null,
    [positionId, positions],
  );
  const opportunity = position
    ? getPositionOpportunity(position, opportunities)
    : null;

  if (!positionsLoading && (!position || !opportunity)) {
    return (
      <main className="container mx-auto flex min-h-[70dvh] max-w-2xl items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-lg font-bold text-cryptoNight dark:text-white">Yield position not found</h1>
          <Button className="mt-4" variant="outline" onClick={() => router.push("/")}>Back to wallet</Button>
        </div>
      </main>
    );
  }

  const amount = position ? getPositionValue(position) : 0;
  const title = opportunity?.symbol || "Yield position";
  const protocol = opportunity ? getProtocolName(opportunity.protocol) : "Loading";

  return (
    <main className="container mx-auto min-h-[100dvh] w-full max-w-5xl px-4 pb-32 pt-4 md:px-6 md:pb-12 md:pt-28">
      <header className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back to wallet"
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-secondary-50/70 text-cryptoNight transition hover:bg-primary-90/10 hover:text-primary-90 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-primary-30"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold text-cryptoNight dark:text-white">Yield position</h1>
        <button
          type="button"
          onClick={() => {
            void refetchPositions();
            void refetchOpportunities();
          }}
          aria-label="Refresh yield position"
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-secondary-50/70 text-cryptoNight transition hover:bg-primary-90/10 hover:text-primary-90 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-primary-30"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>

      <section className="overflow-hidden rounded-2xl border border-gray-80 bg-white/70 p-5 dark:border-white/10 dark:bg-secondary-50/60 md:p-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="flex min-w-0 items-center gap-4">
            <AssetNetworkIcon symbol={title} network={opportunity?.chain || ""} size="md" />
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-cryptoNight dark:text-white">{title}</h2>
              <p className="truncate text-sm text-gray-30 dark:text-gray-40">{protocol} · {opportunity?.chain}</p>
            </div>
          </div>
          <span className="w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
            {position?.status || "Loading"}
          </span>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <PositionMetric label="Supplied" value={`${formatTokenAmount(amount)} ${title}`} />
          <PositionMetric label="Current APY" value={formatApy(opportunity?.apy || 0)} tone="positive" />
          <PositionMetric label="Entry APY" value={formatApy(position?.entryApy || 0)} tone="positive" />
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-gray-80 pt-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-30 dark:text-gray-40">Manage this position securely from your wallet.</p>
          <Button type="button" variant="flow" className="h-11 px-6" disabled={!position || !opportunity} onClick={() => setIsWithdrawOpen(true)}>
            <span className="relative z-10 flex items-center gap-2"><ArrowDownToLine className="h-4 w-4" />Withdraw</span>
          </Button>
        </div>
      </section>

      <EarnActionDialog
        action="withdraw"
        opportunity={opportunity}
        position={position}
        profile={profile}
        open={isWithdrawOpen}
        onOpenChange={setIsWithdrawOpen}
        hideOpportunitySummary
        onComplete={() => {
          setIsWithdrawOpen(false);
          void refetchPositions();
        }}
      />
    </main>
  );
}
