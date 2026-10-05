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
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

const formatPoints = (value?: string) =>
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

  const copyCode = async () => {
    if (!summary) return;
    await navigator.clipboard.writeText(summary.referrals.code);
    toast.success("Referral code copied");
  };

  const share = async () => {
    if (!summary) return;
    const text = `Join me on Kellon and earn rewards. Use my code ${summary.referrals.code}: ${summary.referrals.link}`;
    if (navigator.share) {
      await navigator.share({ text, url: summary.referrals.link }).catch(() => {
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
    <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 md:px-6 md:pb-12 md:pt-8">
      <header className="mb-6 flex flex-col gap-2 md:mb-8">
        <div className="flex items-center gap-2 text-primary-50 dark:text-primary-80">
          <Gift className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-[0.14em]">
            Kellon Rewards
          </span>
        </div>
        <h1 className="text-2xl font-bold text-cryptoNight dark:text-white md:text-3xl">
          Your rewards, {firstName}.
        </h1>
        <p className="max-w-xl text-sm text-gray-20 dark:text-gray-40">
          Track earned points, share your referral, and redeem available perks.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(330px,0.85fr)]">
        <div className="relative overflow-hidden rounded-xl border border-gray-80 bg-white/75 p-5 shadow-sm shadow-primary-90/20 dark:border-white/10 dark:bg-secondary-50/60 dark:shadow-none md:p-7">
          <div className="absolute inset-y-0 left-0 w-1 bg-primary-60" aria-hidden="true" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-30 dark:text-gray-40">
              Available balance
            </p>
            <div className="mt-3 flex items-end gap-2">
              <p className="text-4xl font-extrabold tabular-nums text-cryptoNight dark:text-white md:text-5xl">
                {formatPoints(summary?.balance)}
              </p>
              <span className="mb-1.5 text-sm font-semibold text-gray-20 dark:text-gray-40">
                {pointsUnit}
              </span>
            </div>

            <div className="mt-8 grid max-w-xl grid-cols-2 border-t border-gray-80 pt-5 dark:border-white/10">
              <div className="pr-5">
                <p className="text-xs font-medium text-gray-30 dark:text-gray-40">
                  Lifetime earned
                </p>
                <p className="mt-1.5 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatPoints(summary?.lifetimeEarned)}
                </p>
              </div>
              <div className="border-l border-gray-80 pl-5 dark:border-white/10">
                <p className="text-xs font-medium text-gray-30 dark:text-gray-40">
                  Redeemed
                </p>
                <p className="mt-1.5 text-lg font-bold tabular-nums text-cryptoNight dark:text-white">
                  {formatPoints(summary?.lifetimeRedeemed)}
                </p>
              </div>
            </div>
          </div>
        </div>

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

          <button
            type="button"
            onClick={copyCode}
            className="mt-5 flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-80 bg-gray-95 px-4 py-3 text-left transition hover:border-primary-70/60 dark:border-white/10 dark:bg-secondary-60 dark:hover:border-primary-80/60"
            aria-label="Copy referral code"
          >
            <span className="font-mono text-lg font-bold tracking-[0.18em] text-primary-50 dark:text-primary-80">
              {summary?.referrals.code}
            </span>
            <Copy className="h-4 w-4 text-gray-30 dark:text-gray-40" />
          </button>

          <div className="mt-5 grid grid-cols-2 border-t border-gray-80 pt-4 dark:border-white/10">
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

          <Button onClick={share} variant="flow" size="default" className="mt-5 w-full">
            <Share2 className="h-4 w-4" />
            Share referral link
          </Button>
        </section>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-cryptoNight dark:text-white">
              Redeem rewards
            </h2>
            <p className="mt-1 text-sm text-gray-20 dark:text-gray-40">
              Use your points on available Kellon perks.
            </p>
          </div>
          <Sparkles className="h-5 w-5 text-primary-50 dark:text-primary-80" aria-hidden="true" />
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
              About points
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-20 dark:text-gray-40">
              {pointsUnit.charAt(0).toUpperCase() + pointsUnit.slice(1)} are for
              rewards only and have no cash value.
            </p>
          </div>
          <p className="mt-8 text-xs leading-5 text-gray-30 dark:text-gray-40">
            Earned points and available perks can change as the program evolves.
          </p>
        </aside>
      </section>
    </main>
  );
}
