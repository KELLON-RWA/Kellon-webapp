"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Gift,
  Loader2,
  Share2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { User } from "@/types/db";
import {
  rewardsService,
  type RewardCatalogItem,
  type RewardLedgerEntry,
  type RewardsSummary,
} from "@/services/api/rewards";

interface RewardsPageProps {
  profile: User;
  referralCode?: string;
}

const formatPoints = (value?: string | number) =>
  Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

const formatLedgerDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

const formatRewardLabel = (entry: RewardLedgerEntry) =>
  (entry.source || entry.type || "Reward activity").replace(/_/g, " ");

export default function RewardsPage({
  profile,
  referralCode,
}: RewardsPageProps) {
  const [summary, setSummary] = useState<RewardsSummary | null>(null);
  const [catalog, setCatalog] = useState<RewardCatalogItem[]>([]);
  const [ledger, setLedger] = useState<RewardLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  const firstName = useMemo(
    () => profile.name?.trim().split(/\s+/)[0] || "there",
    [profile.name],
  );

  const load = useCallback(async () => {
    try {
      const [summaryData, catalogData, ledgerData] = await Promise.all([
        rewardsService.getSummary(),
        rewardsService.getCatalog(),
        rewardsService.getLedger(20, 0),
      ]);
      setSummary(summaryData);
      setCatalog(catalogData);
      setLedger(ledgerData.entries);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load rewards",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      if (referralCode) {
        try {
          await rewardsService.attributeReferral(referralCode);
        } catch {
          // An invalid or previously used referral should not interrupt the page.
        }
      }
      await load();
    })();
  }, [referralCode, load]);

  const referralLink =
    summary?.referrals.link ||
    (summary?.referrals.code && typeof window !== "undefined"
      ? `${window.location.origin}/rewards?ref=${encodeURIComponent(summary.referrals.code)}`
      : "");

  const balance = Number(summary?.balance || 0);
  const nextReward = [...catalog]
    .sort((left, right) => Number(left.costPoints) - Number(right.costPoints))
    .find((item) => Number(item.costPoints) > balance);
  const nextRewardCost = Number(nextReward?.costPoints || 0);
  const pointsToNextReward = Math.max(0, nextRewardCost - balance);
  const nextRewardProgress = nextRewardCost
    ? Math.min(100, (balance / nextRewardCost) * 100)
    : 0;

  const copyReferralLink = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    toast.success("Referral link copied");
  };

  const share = async () => {
    if (!summary || !referralLink) return;
    const text = `Join me on Kellon and earn rewards: ${referralLink}`;
    if (navigator.share) {
      await navigator.share({ text, url: referralLink }).catch(() => {
        // Dismissing the share sheet is not an error state.
      });
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Referral link copied");
    }
  };

  const redeem = async (item: RewardCatalogItem) => {
    if (
      !window.confirm(
        `Redeem ${item.name} for ${Number(item.costPoints).toLocaleString()} points?`,
      )
    )
      return;

    setRedeeming(item.code);
    try {
      await rewardsService.redeem(item.code);
      toast.success(`${item.name} redeemed`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not redeem");
    } finally {
      setRedeeming(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary-50 dark:text-primary-80" />
      </div>
    );
  }

  const pointsUnit = summary?.program.unit || "points";

  return (
    <main className="container mx-auto min-h-[100dvh] w-full max-w-7xl px-4 pb-32 pt-4 md:px-6 md:pb-12 md:pt-28">
      <header className="mb-6 flex flex-col gap-2 md:mb-8">
        <h1 className="text-2xl font-bold text-cryptoNight dark:text-white md:text-3xl">
          Your rewards, {firstName}.
        </h1>
        <p className="max-w-xl text-sm text-gray-20 dark:text-gray-40">
          Track earned points, share your referral, and redeem available perks.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(330px,0.85fr)]">
        <section className="relative flex min-h-[210px] w-full flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/70 p-4 text-left text-gray-20 shadow-sm shadow-primary-90/30 backdrop-blur-xl dark:border-white/10 dark:bg-secondary-50/20 dark:text-gray-40 dark:shadow-none md:min-h-[280px] md:justify-between md:rounded-xl md:border-white/80 md:bg-white/75 md:p-6 md:text-cryptoNight md:shadow-md md:shadow-primary-90/25 md:dark:border-white/10 md:dark:bg-secondary-50/20 md:dark:text-white md:dark:shadow-none min-[1024px]:min-h-[178px] min-[1024px]:p-4">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[radial-gradient(circle_at_18%_0%,rgba(138,22,133,0.28),transparent_46%),radial-gradient(circle_at_72%_18%,rgba(209,71,163,0.16),transparent_44%),linear-gradient(115deg,rgba(255,255,255,0.76),rgba(246,232,242,0.72)_44%,rgba(255,255,255,0.32))] dark:hidden md:h-52 min-[1024px]:h-28" />
          <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-44 dark:block dark:bg-[radial-gradient(circle_at_20%_0%,rgba(193,92,165,0.45),transparent_48%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.14),transparent_38%)] md:h-52 min-[1024px]:h-28" />

          <div className="relative flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-[10px] font-bold tracking-tight text-gray-20 shadow-sm shadow-primary-90/20 dark:border-white/10 dark:bg-white/10 dark:text-white/75 dark:shadow-none md:w-fit md:backdrop-blur">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-black/10 bg-primary-99 text-primary-50 dark:border-white/10 dark:bg-white/5 dark:text-primary-80">
              <Gift className="h-2.5 w-2.5" aria-hidden="true" />
            </span>
            Rewards balance
          </div>

          <div className="relative flex flex-1 flex-col justify-center pt-4 min-[1024px]:justify-start min-[1024px]:pt-5">
            <div className="flex items-baseline gap-2">
              <h2 className="text-3xl font-bold leading-none tabular-nums text-cryptoNight dark:text-white md:text-5xl min-[1024px]:text-3xl">
                {formatPoints(summary?.balance)}
              </h2>
              <span className="text-sm font-semibold text-gray-20 dark:text-gray-40 min-[1024px]:text-xs">
                {pointsUnit}
              </span>
            </div>
            <p className="mt-2 text-xs font-semibold text-gray-20 dark:text-gray-40 md:text-base md:dark:text-white/70 min-[1024px]:hidden">
              Earned {formatPoints(summary?.lifetimeEarned)} · Redeemed{" "}
              {formatPoints(summary?.lifetimeRedeemed)}
            </p>
          </div>

          <div className="relative mt-4 min-[1024px]:mt-auto min-[1024px]:max-w-[48%]">
            {nextReward ? (
              <>
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <p className="truncate font-semibold text-cryptoNight dark:text-white">
                    Next perk: {nextReward.name}
                  </p>
                  <span className="shrink-0 tabular-nums text-gray-30 dark:text-gray-40">
                    {formatPoints(pointsToNextReward)} to go
                  </span>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
                  role="progressbar"
                  aria-label={`Progress toward ${nextReward.name}`}
                  aria-valuemin={0}
                  aria-valuemax={nextRewardCost}
                  aria-valuenow={Math.min(balance, nextRewardCost)}
                >
                  <div
                    className="h-full rounded-full bg-primary-50 transition-[width] duration-500 dark:bg-primary-70"
                    style={{ width: `${nextRewardProgress}%` }}
                  />
                </div>
              </>
            ) : catalog.length > 0 ? (
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                All available perks are within reach.
              </p>
            ) : (
              <p className="text-xs text-gray-30 dark:text-gray-40">
                Available perks will appear here.
              </p>
            )}
          </div>

          <div className="relative hidden md:grid md:grid-cols-2 md:gap-3 md:pt-5 min-[1024px]:absolute min-[1024px]:right-4 min-[1024px]:top-1/2 min-[1024px]:w-[46%] min-[1024px]:-translate-y-1/2 min-[1024px]:gap-2 min-[1024px]:pt-0">
            <div className="rounded-xl border border-black/10 bg-white/75 p-3 shadow-sm shadow-primary-90/15 backdrop-blur dark:border-white/10 dark:bg-secondary-50 dark:shadow-none min-[1024px]:p-2">
              <p className="text-[10px] font-bold tracking-tight text-gray-30 dark:text-white/35">
                Lifetime earned
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatPoints(summary?.lifetimeEarned)}
              </p>
            </div>
            <div className="rounded-xl border border-black/10 bg-white/75 p-3 shadow-sm shadow-primary-90/15 backdrop-blur dark:border-white/10 dark:bg-secondary-50 dark:shadow-none min-[1024px]:p-2">
              <p className="text-[10px] font-bold tracking-tight text-gray-30 dark:text-white/35">
                Redeemed
              </p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-cryptoNight dark:text-white">
                {formatPoints(summary?.lifetimeRedeemed)}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-80 bg-white/75 p-5 shadow-sm shadow-primary-90/20 dark:border-white/10 dark:bg-secondary-50/60 dark:shadow-none md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-cryptoNight dark:text-white">
                Refer friends
              </h2>
              <p className="mt-1 text-sm leading-5 text-gray-20 dark:text-gray-40">
                You both earn points after their first completed transaction.
              </p>
            </div>
            <Users className="h-5 w-5 shrink-0 text-primary-50 dark:text-primary-80" />
          </div>

          <div className="relative mt-5">
            <Input
              value={referralLink}
              readOnly
              aria-label="Referral link"
              placeholder="Referral link unavailable"
              className="h-11 rounded-lg border-gray-80 bg-gray-95 pr-12 text-sm text-cryptoNight dark:border-white/10 dark:bg-secondary-60 dark:text-white"
            />
            <button
              type="button"
              onClick={copyReferralLink}
              disabled={!referralLink}
              className="absolute right-1 top-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-gray-30 transition hover:bg-white/70 hover:text-primary-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-40 dark:hover:bg-white/10 dark:hover:text-primary-80"
              aria-label="Copy referral link"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 border-t border-gray-80 pt-4 dark:border-white/10">
            <div>
              <p className="text-xs text-gray-30 dark:text-gray-40">Clicks</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-cryptoNight dark:text-white">
                {summary?.referrals.clicks ?? 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-30 dark:text-gray-40">Invited</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-cryptoNight dark:text-white">
                {summary?.referrals.total ?? 0}
              </p>
            </div>
            <div className="border-l border-gray-80 pl-4 dark:border-white/10">
              <p className="text-xs text-gray-30 dark:text-gray-40">Qualified</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-cryptoNight dark:text-white">
                {summary?.referrals.qualified ?? 0}
              </p>
            </div>
          </div>

          <Button
            onClick={share}
            variant="flow"
            size="default"
            className="mt-5 w-full"
            disabled={!referralLink}
          >
            <Share2 className="h-4 w-4" />
            Share referral link
          </Button>
        </section>
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <div>
            <h2 className="text-lg font-bold text-cryptoNight dark:text-white">
              Redeem rewards
            </h2>
            <p className="mt-1 text-sm text-gray-20 dark:text-gray-40">
              Use your points on available Kellon perks.
            </p>
          </div>
        </div>

        {catalog.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-80 px-5 py-10 text-center dark:border-white/10">
            <Gift className="mx-auto h-5 w-5 text-gray-30 dark:text-gray-40" />
            <p className="mt-3 text-sm font-semibold text-cryptoNight dark:text-white">
              No rewards available yet
            </p>
            <p className="mt-1 text-sm text-gray-20 dark:text-gray-40">
              Keep earning points and check back soon.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {catalog.map((item) => {
              const affordable =
                Number(summary?.balance || 0) >= Number(item.costPoints);

              return (
                <article
                  key={item.code}
                  className="flex min-h-48 flex-col rounded-xl border border-gray-80 bg-white/75 p-5 shadow-sm shadow-primary-90/15 dark:border-white/10 dark:bg-secondary-50/60 dark:shadow-none"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-95 text-primary-50 dark:bg-primary-70/15 dark:text-primary-80">
                      <Gift className="h-5 w-5" />
                    </div>
                    <span className="rounded-md bg-gray-95 px-2 py-1 text-xs font-bold tabular-nums text-cryptoNight dark:bg-secondary-60 dark:text-white">
                      {formatPoints(item.costPoints)} pts
                    </span>
                  </div>
                  <h3 className="mt-5 text-base font-bold text-cryptoNight dark:text-white">
                    {item.name}
                  </h3>
                  <p className="mt-1 min-h-10 text-sm leading-5 text-gray-20 dark:text-gray-40">
                    {item.description || "A Kellon reward available with your points."}
                  </p>
                  {!affordable ? (
                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-3 text-xs text-gray-30 dark:text-gray-40">
                        <span>{formatPoints(Number(item.costPoints) - balance)} more needed</span>
                        <span className="tabular-nums">
                          {Math.floor((balance / Number(item.costPoints)) * 100)}%
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-90 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-primary-70"
                          style={{
                            width: `${Math.min(100, (balance / Number(item.costPoints)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                  <Button
                    variant={affordable ? "flow" : "flowSecondary"}
                    size="sm"
                    disabled={!affordable || redeeming === item.code}
                    onClick={() => redeem(item)}
                    className="mt-auto w-full"
                  >
                    {redeeming === item.code ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : affordable ? (
                      <>
                        Redeem <ArrowUpRight className="h-4 w-4" />
                      </>
                    ) : (
                      "Need more points"
                    )}
                  </Button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="overflow-hidden rounded-xl border border-gray-80 bg-white/75 shadow-sm shadow-primary-90/15 dark:border-white/10 dark:bg-secondary-50/60 dark:shadow-none">
          <div className="flex items-center justify-between border-b border-gray-80 px-5 py-4 dark:border-white/10">
            <div>
              <h2 className="text-lg font-bold text-cryptoNight dark:text-white">
                Points activity
              </h2>
              <p className="mt-0.5 text-sm text-gray-20 dark:text-gray-40">
                Your latest rewards movements.
              </p>
            </div>
          </div>

          {ledger.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <CheckCircle2 className="mx-auto h-5 w-5 text-gray-30 dark:text-gray-40" />
              <p className="mt-3 text-sm font-semibold text-cryptoNight dark:text-white">
                No points activity yet
              </p>
              <p className="mt-1 text-sm text-gray-20 dark:text-gray-40">
                Complete a transaction or invite a friend to start earning.
              </p>
            </div>
          ) : (
            <ul>
              {ledger.map((entry) => {
                const positive = Number(entry.delta) >= 0;
                return (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-4 border-b border-gray-80 px-5 py-4 last:border-b-0 dark:border-white/10"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                          positive
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-300",
                        )}
                      >
                        {positive ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 rotate-90" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold capitalize text-cryptoNight dark:text-white">
                          {formatRewardLabel(entry)}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-30 dark:text-gray-40">
                          {formatLedgerDate(entry.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          "text-sm font-bold tabular-nums",
                          positive
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-300",
                        )}
                      >
                        {positive ? "+" : ""}
                        {formatPoints(entry.delta)}
                      </p>
                      {entry.balanceAfter ? (
                        <p className="mt-0.5 text-xs text-gray-30 dark:text-gray-40">
                          {formatPoints(entry.balanceAfter)} total
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="flex flex-col justify-between rounded-xl border border-gray-80 bg-gray-95 p-5 dark:border-white/10 dark:bg-secondary-60/50">
          <div>
            <Gift className="h-5 w-5 text-primary-50 dark:text-primary-80" />
            <h2 className="mt-4 text-base font-bold text-cryptoNight dark:text-white">
              Program details
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-20 dark:text-gray-40">
              {summary?.program.name || "Kellon Rewards"}
            </p>
            <dl className="mt-5 space-y-3 border-t border-gray-80 pt-4 text-sm dark:border-white/10">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-30 dark:text-gray-40">Unit</dt>
                <dd className="font-semibold capitalize text-cryptoNight dark:text-white">
                  {pointsUnit}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-30 dark:text-gray-40">Rate</dt>
                <dd className="text-right font-semibold tabular-nums text-cryptoNight dark:text-white">
                  {formatPoints(summary?.program.pointsPerUsd)} / {summary?.program.valuationAsset || "USD"}
                </dd>
              </div>
            </dl>
          </div>
          <p className="mt-8 text-xs leading-5 text-gray-30 dark:text-gray-40">
            {pointsUnit.charAt(0).toUpperCase() + pointsUnit.slice(1)} are for
            rewards only and have no cash value.
          </p>
        </aside>
      </section>
    </main>
  );
}
