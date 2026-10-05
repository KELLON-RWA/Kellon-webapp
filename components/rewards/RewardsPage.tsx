"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Copy, Gift, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

export default function RewardsPage({ referralCode }: RewardsPageProps) {
  const [summary, setSummary] = useState<RewardsSummary | null>(null);
  const [catalog, setCatalog] = useState<RewardCatalogItem[]>([]);
  const [ledger, setLedger] = useState<RewardLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);

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
      toast.error(error instanceof Error ? error.message : "Failed to load rewards");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (referralCode) {
        try {
          await rewardsService.attributeReferral(referralCode);
        } catch {
          /* an already-attributed or invalid code is not worth interrupting the page */
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
      await navigator.share({ text, url: summary.referrals.link }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Referral link copied");
    }
  };

  const redeem = async (item: RewardCatalogItem) => {
    if (!window.confirm(`Redeem ${item.name} for ${Number(item.costPoints).toLocaleString()} points?`)) return;
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
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Rewards</h1>
        <p className="text-sm text-muted-foreground">
          Earn points for your activity and invite friends.
        </p>
      </div>

      <Card className="flex flex-col gap-2 p-6">
        <span className="text-sm text-muted-foreground">Points balance</span>
        <span className="text-4xl font-extrabold">{formatPoints(summary?.balance)}</span>
        <span className="text-xs text-muted-foreground">
          Earned {formatPoints(summary?.lifetimeEarned)} · Redeemed {formatPoints(summary?.lifetimeRedeemed)}
        </span>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Refer a friend</h2>
        <Card className="flex flex-col gap-4 p-6">
          <p className="text-sm text-muted-foreground">
            You both earn points when they complete their first transaction.
          </p>
          <button
            onClick={copyCode}
            className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-left"
          >
            <span className="text-lg font-extrabold tracking-widest text-primary">
              {summary?.referrals.code}
            </span>
            <Copy className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="flex gap-6">
            <div>
              <div className="text-xl font-bold">{summary?.referrals.total ?? 0}</div>
              <div className="text-xs text-muted-foreground">Invited</div>
            </div>
            <div>
              <div className="text-xl font-bold">{summary?.referrals.qualified ?? 0}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </div>
          <Button onClick={share} className="w-full">
            <Share2 className="mr-2 h-4 w-4" /> Share your link
          </Button>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Redeem</h2>
        {catalog.length === 0 && (
          <p className="text-sm text-muted-foreground">No rewards available yet.</p>
        )}
        {catalog.map((item) => {
          const affordable = Number(summary?.balance || 0) >= Number(item.costPoints);
          return (
            <Card key={item.code} className="flex flex-col gap-3 p-5">
              <div>
                <div className="font-semibold">{item.name}</div>
                {item.description && (
                  <div className="text-sm text-muted-foreground">{item.description}</div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-primary">{formatPoints(item.costPoints)} pts</span>
                <Button
                  variant={affordable ? "default" : "secondary"}
                  disabled={!affordable || redeeming === item.code}
                  onClick={() => redeem(item)}
                >
                  {redeeming === item.code ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : affordable ? (
                    "Redeem"
                  ) : (
                    "Need more"
                  )}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Recent activity</h2>
        {ledger.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No activity yet. Complete a transaction to earn points.
          </p>
        )}
        {ledger.map((entry) => {
          const positive = Number(entry.delta) >= 0;
          return (
            <div
              key={entry.id}
              className="flex items-center justify-between border-b border-border py-3"
            >
              <div>
                <div className="text-sm font-medium capitalize">
                  {entry.source ? entry.source.replace(/_/g, " ") : entry.type}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleDateString()}
                </div>
              </div>
              <span className={cn("font-bold", positive ? "text-green-500" : "text-red-500")}>
                {positive ? "+" : ""}
                {formatPoints(entry.delta)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Gift className="h-4 w-4" />
        Points are for rewards only and have no cash value.
      </div>
    </div>
  );
}
