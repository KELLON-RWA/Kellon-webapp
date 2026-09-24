"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  BadgeCheck,
  Clock3,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import AssetNetworkIcon from "@/components/wallet/AssetNetworkIcon";
import ChainIcon from "@/components/wallet/ChainIcon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { yieldService } from "@/services/api/yield";
import type { User } from "@/types/db";
import EarnActionDialog from "./EarnActionDialog";
import {
  formatApy,
  formatTokenAmount,
  formatUsd,
  getPositionOpportunity,
  getPositionValue,
  getProtocolName,
  toNumber,
} from "./earn-utils";

function YieldMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive";
}) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-80 bg-black/[0.02] px-1.5 py-3 text-center dark:border-white/10 dark:bg-white/[0.04] sm:px-3">
      <p className="whitespace-nowrap text-[10px] text-gray-30 dark:text-gray-40 sm:text-[11px]">{label}</p>
      <p
        className={cn(
          "mt-1 truncate text-sm font-semibold tabular-nums text-cryptoNight dark:text-white",
          tone === "positive" && "text-emerald-600 dark:text-emerald-300",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "positive";
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-80 py-3.5 last:border-b-0 dark:border-white/10 sm:gap-4 sm:py-4">
      <span className="min-w-0 text-xs text-gray-30 dark:text-gray-40 sm:text-sm">{label}</span>
      <span
        className={cn(
          "inline-flex max-w-[62%] shrink-0 items-center gap-1.5 text-right text-xs font-semibold leading-5 text-cryptoNight dark:text-white sm:max-w-[65%] sm:text-sm",
          tone === "positive" && "text-emerald-600 dark:text-emerald-300",
        )}
      >
        {icon}
        <span>{value}</span>
      </span>
    </div>
  );
}

function holdingPeriod(value?: Date) {
  if (!value) return "Recently started";
  const elapsedDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000),
  );
  if (elapsedDays < 1) return "Recently started";
  return `${elapsedDays} ${elapsedDays === 1 ? "day" : "days"}`;
}

export default function YieldPositionDetailsPage({
  profile,
  positionId,
}: {
  profile: User;
  positionId: string;
}) {
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<
    "supply" | "withdraw" | null
  >(null);
  const {
    data: positions = [],
    isLoading: positionsLoading,
    refetch: refetchPositions,
  } = useQuery({
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
          <h1 className="text-lg font-bold text-cryptoNight dark:text-white">
            Yield position not found
          </h1>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() => router.push("/")}
          >
            Back to wallet
          </Button>
        </div>
      </main>
    );
  }

  const amount = position ? getPositionValue(position) : 0;
  const symbol = opportunity?.symbol || "USDC";
  const protocol = opportunity
    ? getProtocolName(opportunity.protocol)
    : "Loading";
  const currentApy = toNumber(opportunity?.apy);
  const entryApy = toNumber(position?.entryApy);
  const dailyYield = (amount * currentApy) / 100 / 365;
  const monthlyYield = (amount * currentApy) / 100 / 12;
  const chain = opportunity?.chain || "Base";
  const status = position?.status || "ACTIVE";
  const refresh = () => {
    void refetchPositions();
    void refetchOpportunities();
  };

  return (
    <main className="container mx-auto min-h-[100dvh] w-full max-w-7xl px-4 pb-28 pt-4 md:px-6 md:pb-12 md:pt-28">
      <header className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back to wallet"
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-secondary-50/70 text-cryptoNight transition hover:bg-primary-90/10 hover:text-primary-90 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-primary-30"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 text-center">
          <h1 className="truncate text-base font-bold text-cryptoNight dark:text-white">
            {protocol}
          </h1>
          <p className="truncate text-xs text-gray-30 dark:text-gray-40">
            {symbol} · {chain.toUpperCase()}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          aria-label="Refresh yield position"
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-secondary-50/70 text-cryptoNight transition hover:bg-primary-90/10 hover:text-primary-90 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-primary-30"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>

      <section className="rounded-2xl border border-gray-80 bg-white/70 p-5 text-center shadow-sm dark:border-white/10 dark:bg-secondary-50/60 md:p-7">
        <div className="flex justify-center">
          <AssetNetworkIcon symbol={symbol} network={chain} size="md" />
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <h2 className="text-xl font-bold text-cryptoNight dark:text-white">
            {protocol}
          </h2>
          {opportunity?.isWhitelisted ? (
            <BadgeCheck
              className="h-4 w-4 text-primary-90 dark:text-primary-30"
              aria-label="Whitelisted protocol"
            />
          ) : null}
        </div>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {opportunity?.riskLevel || "Conservative"}
        </span>
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-30 dark:text-gray-40">
          Staked position
        </p>
        <p className="mt-1 text-4xl font-bold tabular-nums text-cryptoNight dark:text-white">
          {formatUsd(amount)}
        </p>
        <div className="mt-6 grid grid-cols-3 gap-2.5">
          <YieldMetric
            label="Live APY"
            value={formatApy(currentApy)}
            tone="positive"
          />
          <YieldMetric label="Daily yield" value={formatUsd(dailyYield)} />
          <YieldMetric label="Monthly" value={formatUsd(monthlyYield)} />
        </div>
      </section>

      <div className="mt-7 grid gap-7 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-base font-bold text-cryptoNight dark:text-white">
            Position details
          </h2>
          <div className="rounded-2xl border border-gray-80 bg-white/70 px-5 dark:border-white/10 dark:bg-secondary-50/60">
            <DetailRow label="Supplied" value={`${formatTokenAmount(amount)} ${symbol}`} />
            <DetailRow label="APY (entry → live)" value={`${formatApy(entryApy)} → ${formatApy(currentApy)}`} tone="positive" />
            <DetailRow label="Holding period" value={holdingPeriod(position?.createdAt)} icon={<Clock3 className="h-4 w-4 shrink-0 text-gray-30 dark:text-gray-40" />} />
            <DetailRow label="Position status" value={status === "ACTIVE" ? "Supplied & earning" : getProtocolName(status)} tone={status === "ACTIVE" ? "positive" : undefined} icon={status === "ACTIVE" ? <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" /> : undefined} />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-base font-bold text-cryptoNight dark:text-white">
            Security & protocol info
          </h2>
          <div className="rounded-2xl border border-gray-80 bg-white/70 px-5 dark:border-white/10 dark:bg-secondary-50/60">
            <DetailRow label="Underlying protocol" value={protocol} />
            <DetailRow label="Settlement network" value={chain.toUpperCase()} icon={<ChainIcon name={chain} size={18} />} />
            <DetailRow label="Smart contract safety" value={opportunity?.isWhitelisted ? "Audited & whitelisted" : "Protocol verified"} tone="positive" icon={<ShieldCheck className="h-4 w-4 shrink-0" />} />
            <DetailRow label="Liquidity & terms" value="Instant liquid unstaking" />
          </div>
        </section>
      </div>

      <div className="mt-7 hidden grid-cols-2 gap-3 md:grid">
        <Button
          type="button"
          variant="outline"
          className="h-12 border-rose-500/40 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200"
          disabled={!position || !opportunity}
          onClick={() => setActiveAction("withdraw")}
        >
          <ArrowDownToLine className="h-4 w-4" /> Withdraw
        </Button>
        <Button
          type="button"
          variant="flow"
          className="h-12"
          disabled={!opportunity}
          onClick={() => setActiveAction("supply")}
        >
          <span className="relative z-10 flex items-center gap-2">
            <ArrowUpFromLine className="h-4 w-4" /> Deposit
          </span>
        </Button>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-80 bg-white/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-secondary-50/95 md:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-12 border-rose-500/40 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200"
            disabled={!position || !opportunity}
            onClick={() => setActiveAction("withdraw")}
          >
            Withdraw
          </Button>
          <Button
            type="button"
            variant="flow"
            className="h-12"
            disabled={!opportunity}
            onClick={() => setActiveAction("supply")}
          >
            <span className="relative z-10">Deposit</span>
          </Button>
        </div>
      </div>

      <EarnActionDialog
        action={activeAction || "withdraw"}
        opportunity={opportunity}
        position={position}
        profile={profile}
        open={activeAction !== null}
        onOpenChange={(open) => {
          if (!open) setActiveAction(null);
        }}
        hideOpportunitySummary
        onComplete={() => {
          setActiveAction(null);
          refresh();
        }}
      />
    </main>
  );
}
