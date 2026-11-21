"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallets } from "@privy-io/react-auth";
import {
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LockOpen,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  XOctagon,
  Copy,
  Gift,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TransferVerificationModal from "@/components/wallet/send/TransferVerificationModal";
import { getMaxUsableBalanceForChain } from "@/components/earn/earn-utils";
import {
  useSmartAccount,
  setStickyVerificationCode,
} from "@/hooks/useSmartAccount";
import { expectedSafeFor, resolveEvmSigner } from "@/lib/evm-signer";
import { beginOperation, endOperation } from "@/services/api";
import {
  findTransferVerificationRequiredError,
  transferService,
} from "@/services/api/transfers";
import {
  CARD_CHAIN_LABELS,
  cardsService,
  isFinalCardOperation,
  type CardOperation,
  type CardProgram,
  type CardQuote,
  type CardSecrets,
  type CardVerification,
  type FundingOrder,
  type HolderAddress,
  type VirtualCard,
} from "@/services/api/cards";
import type { User } from "@/types/db";

type VerificationType = CardVerification["verificationType"];
type Pending = {
  run: (verification: CardVerification) => Promise<void>;
  context: "card" | "transfer";
};

const money = (value?: number | string | null) =>
  value === null || value === undefined || value === ""
    ? "—"
    : `$${Number(value).toFixed(2)}`;

const verificationTypeFor = (methods?: string[]): VerificationType =>
  methods?.includes("totp")
    ? "totp"
    : methods?.includes("sms_otp")
      ? "sms_otp"
      : "email_otp";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ACTIVITY_LABEL: Record<string, string> = {
  "transaction.authorized": "Payment",
  "transaction.settled": "Payment settled",
  "transaction.preauthorized": "Hold",
  "transaction.declined": "Declined",
  "transaction.reversed": "Reversed",
  "transaction.expired": "Hold released",
  "transaction.refund_authorized": "Refund pending",
  "transaction.refund_settled": "Refund",
  "fee.cross_border": "Cross-border fee",
  "fee.cross_border_reversed": "Fee reversed",
  "fee.contactless": "Contactless fee",
  "fee.decline": "Decline fee",
  "topup.completed": "Top-up",
  "withdrawal.completed": "Withdrawal",
  terminated: "Card closed",
};
const CREDIT_TYPES = new Set([
  "transaction.refund_settled",
  "transaction.reversed",
  "transaction.expired",
  "topup.completed",
  "fee.cross_border_reversed",
]);

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "border-primary-50 bg-primary-50/10 text-primary-50 dark:text-primary-80"
          : "border-gray-80 text-cryptoNight hover:border-primary-50 dark:border-white/10 dark:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function CardFace({
  card,
  secrets,
  onClick,
  active,
}: {
  card: VirtualCard;
  secrets?: CardSecrets | null;
  onClick?: () => void;
  active?: boolean;
}) {
  const dim = card.status !== "ACTIVE";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex aspect-[1.586] w-full flex-col justify-between rounded-2xl p-5 text-left text-white shadow-lg transition ${
        dim
          ? "bg-slate-700"
          : "bg-gradient-to-br from-indigo-950 via-indigo-800 to-indigo-500"
      } ${active ? "ring-2 ring-primary-50 ring-offset-2 dark:ring-offset-secondary-40" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold tracking-widest">KELLON</span>
        <span className="text-xs font-bold tracking-wider">
          {card.brand.toUpperCase()}
        </span>
      </div>
      <p className="font-mono text-lg tracking-widest sm:text-xl">
        {secrets
          ? secrets.cardNumber.match(/.{1,4}/g)?.join(" ")
          : `•••• •••• •••• ${card.last4}`}
      </p>
      <div className="flex items-end justify-between text-xs">
        <div>
          <p className="text-[10px] text-white/70">BALANCE</p>
          <p className="font-semibold">{money(card.balance)}</p>
        </div>
        {secrets ? (
          <div className="text-right">
            <p className="text-[10px] text-white/70">EXP · CVV</p>
            <p className="font-semibold">
              {secrets.expiry.slice(5, 7)}/{secrets.expiry.slice(2, 4)} ·{" "}
              {secrets.cvv}
            </p>
          </div>
        ) : dim ? (
          <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-bold">
            {card.status === "TERMINATED" ? "CLOSED" : card.status}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export default function CardsPage({ profile }: { profile: User }) {
  const queryClient = useQueryClient();
  const { wallets } = useWallets();
  const { getSmartAccountClient } = useSmartAccount();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [secrets, setSecrets] = useState<CardSecrets | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [dialog, setDialog] = useState<"issue" | "topup" | "withdraw" | null>(
    null,
  );
  const [verification, setVerification] = useState<{
    type: VerificationType;
    pending: Pending;
  } | null>(null);

  const [address, setAddress] = useState<HolderAddress>({
    line1: "",
    city: "",
    state: "",
    zipCode: "",
    country: "NG",
  });
  const [phone, setPhone] = useState("");
  const [brand, setBrand] = useState("Mastercard");
  const [amount, setAmount] = useState("20");
  const [chain, setChain] = useState("base");
  const [asset, setAsset] = useState("USDC");
  const [quote, setQuote] = useState<CardQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const programQuery = useQuery({
    queryKey: ["cards-program"],
    queryFn: async () => (await cardsService.getProgram()).data,
  });
  const program: CardProgram | undefined = programQuery.data;
  const holder = program?.holder ?? null;
  const approved = holder?.status === "APPROVED";

  const cardsQuery = useQuery({
    queryKey: ["cards-list"],
    queryFn: async () => (await cardsService.list()).data,
    enabled: Boolean(program?.enabled && approved),
  });
  const cards = useMemo(
    () => (cardsQuery.data ?? []).filter((c) => c.status !== "TERMINATED"),
    [cardsQuery.data],
  );
  const selected = cards.find((c) => c.id === selectedId) ?? cards[0] ?? null;

  const detailQuery = useQuery({
    queryKey: ["cards-detail", selected?.id],
    queryFn: async () => (await cardsService.get(selected!.id)).data,
    enabled: Boolean(selected),
  });
  const activityQuery = useQuery({
    queryKey: ["cards-activity", selected?.id],
    queryFn: async () => (await cardsService.activity(selected!.id)).data,
    enabled: Boolean(selected),
  });
  const card = detailQuery.data ?? selected;

  useEffect(() => {
    if (!program) return;
    setBrand(program.defaultBrand);
    setChain((c) =>
      program.funding.chains.includes(c)
        ? c
        : (program.funding.chains[0] ?? "base"),
    );
    setAsset((a) =>
      program.funding.assets.includes(a)
        ? a
        : (program.funding.assets[0] ?? "USDC"),
    );
    if (holder?.address) setAddress(holder.address);
    else setAddress((a) => ({ ...a, country: program.countries[0] ?? "NG" }));
  }, [program, holder]);

  useEffect(() => setSecrets(null), [selected?.id]);

  const fundingType =
    dialog === "issue"
      ? "ISSUE"
      : dialog === "topup"
        ? "TOPUP"
        : dialog === "withdraw"
          ? "WITHDRAW"
          : null;
  const payoutChains = useMemo(() => program?.payout.chains ?? [], [program]);
  useEffect(() => {
    if (
      dialog === "withdraw" &&
      payoutChains.length &&
      !payoutChains.includes(chain)
    )
      setChain(payoutChains[0]);
  }, [dialog, payoutChains, chain]);

  useEffect(() => {
    const value = Number(amount);
    if (!fundingType || !(value > 0)) {
      setQuote(null);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      cardsService
        .quote({
          type: fundingType,
          amount: value,
          chain,
          asset: fundingType === "WITHDRAW" ? undefined : asset,
        })
        .then((res) => live && (setQuote(res.data), setQuoteError(null)))
        .catch(
          (error: Error) =>
            live && (setQuote(null), setQuoteError(error.message)),
        );
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [fundingType, amount, chain, asset]);

  const balance = getMaxUsableBalanceForChain(profile, asset, chain);
  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]).startsWith("cards-"),
    });

  const challenge = (error: unknown, pending: Pending): boolean => {
    const mfa = findTransferVerificationRequiredError(error);
    if (!mfa) return false;
    setVerification({
      type: verificationTypeFor(mfa.availableMethods),
      pending,
    });
    return true;
  };

  const runGuarded = async (
    run: (v?: CardVerification) => Promise<void>,
    verificationArg?: CardVerification,
  ) => {
    setBusy(true);
    try {
      await run(verificationArg);
      setVerification(null);
    } catch (error) {
      if (
        !challenge(error, { run: (v) => runGuarded(run, v), context: "card" })
      ) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const submitHolder = async () => {
    if (
      !address.line1.trim() ||
      !address.city.trim() ||
      !address.state.trim() ||
      !address.zipCode.trim()
    ) {
      toast.error("Fill in your full address.");
      return;
    }
    setBusy(true);
    try {
      const next = (
        await cardsService.submitHolder(address, phone.trim() || undefined)
      ).data;
      if (next.verificationLink)
        window.open(next.verificationLink, "_blank", "noopener");
      else if (next.status === "PENDING")
        toast.success("Submitted. We'll notify you when you're approved.");
      await programQuery.refetch();
    } catch (error) {
      const code = (error as { code?: string }).code;
      toast.error(
        code === "KYC_REQUIRED"
          ? "Verify your identity in Settings first, then come back."
          : error instanceof Error
            ? error.message
            : "Could not submit",
      );
    } finally {
      setBusy(false);
    }
  };

  const payOrder = async (order: FundingOrder): Promise<CardOperation> => {
    const signer = resolveEvmSigner(wallets, profile.chainAccounts);
    if (!signer)
      throw new Error(
        "Your wallet is not available on this device. Log out and back in.",
      );
    const client = await getSmartAccountClient(
      signer,
      order.payment.chain,
      expectedSafeFor(profile.chainAccounts, order.payment.chain),
    );
    if (!client?.account?.address)
      throw new Error("Your smart account is not ready for this network.");
    if (
      client.account.address.toLowerCase() !== order.payment.from.toLowerCase()
    ) {
      throw new Error(
        "This payment must come from your Kellon wallet on this network.",
      );
    }
    setStatus(`Paying ${order.payment.amount} ${order.payment.asset}…`);
    const sender = client as unknown as {
      sendTransaction: (args: Record<string, unknown>) => Promise<string>;
    };
    const txHash = await sender.sendTransaction({
      account: client.account,
      calls: order.calls.map((c) => ({
        to: c.to as `0x${string}`,
        data: (c.data || "0x") as `0x${string}`,
        value: BigInt(c.value || "0"),
      })),
    });
    setStatus("Confirming your payment…");
    let op = (await cardsService.confirmPayment(order.operation.id, txHash))
      .data;
    const started = Date.now();
    while (!isFinalCardOperation(op.status) && Date.now() - started < 180_000) {
      setStatus(
        op.status === "AWAITING_PAYMENT"
          ? "Confirming your payment…"
          : order.operation.type === "ISSUE"
            ? "Creating your card…"
            : "Loading your card…",
      );
      await sleep(4000);
      op = (await cardsService.getOperation(op.id)).data;
    }
    return op;
  };

  const fund = async (transferVerification?: CardVerification) => {
    if (!quote || !program) return;
    if (Number(quote.totalUsd) > balance) {
      toast.error(
        `You need ${Number(quote.totalUsd).toFixed(2)} ${asset} on ${CARD_CHAIN_LABELS[chain] ?? chain}.`,
      );
      return;
    }
    setBusy(true);
    beginOperation(Boolean(transferVerification));
    setStickyVerificationCode(
      transferVerification
        ? {
            type: transferVerification.verificationType,
            code: transferVerification.verificationCode,
          }
        : null,
    );
    try {
      setStatus("Preparing…");
      const value = Number(amount);
      const order =
        dialog === "issue"
          ? (await cardsService.issue({ amount: value, chain, asset, brand }))
              .data
          : (
              await cardsService.topUp(selected!.id, {
                amount: value,
                chain,
                asset,
              })
            ).data;
      const op = await payOrder(order);
      endOperation();
      if (op.status === "COMPLETED") {
        toast.success(
          op.type === "ISSUE"
            ? "Your card is ready."
            : `$${op.amountUsd} added to your card.`,
        );
        if (op.cardId) setSelectedId(op.cardId);
      } else if (
        op.status === "PAYOUT_PENDING" ||
        op.status === "PAYOUT_SENT"
      ) {
        toast.error(
          "The card could not be completed; your payment is being refunded.",
        );
      } else if (op.status === "NEEDS_REVIEW") {
        toast.error(
          "Your payment arrived but needs a manual check. Support will finish it or refund you.",
        );
      } else if (op.status === "FAILED" || op.status === "EXPIRED") {
        toast.error(op.error || "This order did not go through.");
      } else {
        toast.success(
          "Payment confirmed. We'll notify you when the card is ready.",
        );
      }
      setDialog(null);
      setVerification(null);
      refresh();
    } catch (error) {
      endOperation();
      if (!challenge(error, { run: (v) => fund(v), context: "transfer" })) {
        toast.error(error instanceof Error ? error.message : "Payment failed");
      }
    } finally {
      setStickyVerificationCode(null);
      setBusy(false);
      setStatus("");
    }
  };

  const withdraw = () =>
    runGuarded(async (v) => {
      const op = (
        await cardsService.withdraw(
          selected!.id,
          { amount: Number(amount), chain },
          v,
        )
      ).data;
      toast.success(
        `${money(op.payoutUsd)} ${op.asset} will reach your wallet on ${CARD_CHAIN_LABELS[chain] ?? chain} once the card network releases it.`,
      );
      setDialog(null);
      refresh();
    });

  const reveal = () =>
    secrets
      ? setSecrets(null)
      : runGuarded(async (v) =>
          setSecrets((await cardsService.reveal(selected!.id, v)).data),
        );

  const toggleFreeze = () =>
    runGuarded(async (v) => {
      if (card?.status === "FROZEN")
        await cardsService.unfreeze(selected!.id, v);
      else await cardsService.freeze(selected!.id);
      refresh();
    });

  const closeCard = () => {
    if (
      !window.confirm(
        `Close the card ending ${card?.last4}? This can't be undone. Its balance, less the ${program?.pricing ? `$${program.pricing.terminationFee} ` : ""}closing fee, is sent to your wallet.`,
      )
    )
      return;
    runGuarded(async (v) => {
      await cardsService.terminate(selected!.id, v);
      toast.success("Card closed. Its balance is on the way to your wallet.");
      setSelectedId(null);
      refresh();
    });
  };

  const openDialog = (kind: "issue" | "topup" | "withdraw") => {
    setAmount(
      kind === "withdraw"
        ? ""
        : String(
            Math.max(
              program?.limits.minFundingUsd ?? 5,
              kind === "issue" ? 10 : 20,
            ),
          ),
    );
    setQuote(null);
    setDialog(kind);
  };

  if (programQuery.isLoading) {
    return (
      <section className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary-50" />
      </section>
    );
  }

  if (!program?.enabled) {
    return (
      <section className="mx-auto max-w-xl space-y-4 py-10 text-center">
        <CreditCard className="mx-auto size-10 text-primary-50" />
        <h1 className="text-2xl font-bold text-cryptoNight dark:text-white">
          Virtual dollar cards are coming soon
        </h1>
        <p className="text-sm text-gray-30 dark:text-gray-40">
          Spend your USDC and USDT anywhere Visa and Mastercard are accepted,
          topped up straight from your Kellon wallet.
        </p>
      </section>
    );
  }

  const field = (key: keyof HolderAddress, placeholder: string) => (
    <Input
      value={String(address[key] ?? "")}
      onChange={(e) => setAddress((a) => ({ ...a, [key]: e.target.value }))}
      placeholder={placeholder}
      className="h-11 border-gray-80 bg-white dark:border-white/10 dark:bg-secondary-50"
    />
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-cryptoNight dark:text-white">
            Cards
          </h1>
          <p className="text-sm text-gray-30 dark:text-gray-40">
            Virtual dollar cards funded from your stablecoins
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/gift-cards">
              <Gift /> Gift cards
            </Link>
          </Button>
          {approved &&
          program.issuanceEnabled &&
          cards.length < program.limits.maxCards ? (
            <Button onClick={() => openDialog("issue")}>
              <Plus /> New card
            </Button>
          ) : null}
        </div>
      </div>

      {!approved ? (
        <div className="max-w-xl space-y-4 rounded-2xl border border-gray-80 bg-white p-6 dark:border-white/10 dark:bg-secondary-50">
          {holder?.status === "PENDING" ? (
            <>
              <h2 className="text-lg font-bold text-cryptoNight dark:text-white">
                Verification in progress
              </h2>
              <p className="text-sm text-gray-30 dark:text-gray-40">
                {holder.verificationLink
                  ? "Finish the ID check to activate cards on your account."
                  : "We're checking your details with our card partner. This usually takes a few minutes."}
              </p>
              <div className="flex gap-2">
                {holder.verificationLink ? (
                  <Button
                    onClick={() =>
                      window.open(
                        holder.verificationLink!,
                        "_blank",
                        "noopener",
                      )
                    }
                  >
                    Continue verification
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await cardsService.getHolder(true).catch(() => null);
                    await programQuery.refetch();
                    setBusy(false);
                  }}
                >
                  {busy ? <Loader2 className="animate-spin" /> : null} Check
                  status
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-cryptoNight dark:text-white">
                Set up your card account
              </h2>
              <p className="text-sm text-gray-30 dark:text-gray-40">
                We use the identity you already verified with Kellon. Add your
                home address to finish.
              </p>
              {holder?.status === "REJECTED" ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300">
                  Verification failed:{" "}
                  {holder.reason || "check your details and try again."}
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  {field("line1", "Street address")}
                </div>
                {field("city", "City")}
                {field("state", "State")}
                {field("zipCode", "Postal code")}
                <Input
                  value={address.country}
                  disabled
                  className="h-11 border-gray-80 dark:border-white/10"
                />
                <div className="sm:col-span-2">
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone, if not on your profile (e.g. +2348012345678)"
                    className="h-11 border-gray-80 bg-white dark:border-white/10 dark:bg-secondary-50"
                  />
                </div>
              </div>
              <Button onClick={submitHolder} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : null} Continue
              </Button>
            </>
          )}
        </div>
      ) : cards.length === 0 && !cardsQuery.isLoading ? (
        <div className="max-w-xl space-y-3 rounded-2xl border border-dashed border-gray-80 p-8 text-center dark:border-white/10">
          <CreditCard className="mx-auto size-8 text-primary-50" />
          <p className="font-semibold text-cryptoNight dark:text-white">
            No cards yet
          </p>
          <p className="text-sm text-gray-30 dark:text-gray-40">
            Get a virtual dollar card for online payments and subscriptions.
          </p>
          {program.issuanceEnabled ? (
            <Button onClick={() => openDialog("issue")}>Get a card</Button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
          <div className="space-y-4">
            {cards.map((c) => (
              <CardFace
                key={c.id}
                card={c.id === card?.id ? card : c}
                secrets={c.id === card?.id ? secrets : null}
                active={c.id === card?.id}
                onClick={() => setSelectedId(c.id)}
              />
            ))}
          </div>

          {card ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-gray-80 bg-white p-5 dark:border-white/10 dark:bg-secondary-50">
                <div>
                  <p className="text-xs text-gray-30 dark:text-gray-40">
                    Balance
                  </p>
                  <p className="text-3xl font-bold text-cryptoNight dark:text-white">
                    {money(card.balance)}
                  </p>
                  {card.withdrawableBalance != null ? (
                    <p className="text-xs text-gray-30 dark:text-gray-40">
                      {money(card.withdrawableBalance)} withdrawable
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {program.topupEnabled ? (
                    <Button onClick={() => openDialog("topup")}>
                      <ArrowUpFromLine /> Top up
                    </Button>
                  ) : null}
                  {program.withdrawEnabled ? (
                    <Button
                      variant="outline"
                      onClick={() => openDialog("withdraw")}
                    >
                      <ArrowDownToLine /> Withdraw
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={reveal} disabled={busy}>
                  {secrets ? <EyeOff /> : <Eye />}{" "}
                  {secrets ? "Hide details" : "Show details"}
                </Button>
                {secrets ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(secrets.cardNumber);
                      toast.success("Card number copied");
                    }}
                  >
                    <Copy /> Copy number
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={toggleFreeze}
                  disabled={busy}
                >
                  {card.status === "FROZEN" ? <LockOpen /> : <Lock />}{" "}
                  {card.status === "FROZEN" ? "Unfreeze" : "Freeze"}
                </Button>
                <Button
                  variant="outline"
                  onClick={closeCard}
                  disabled={busy}
                  className="text-rose-600 dark:text-rose-400"
                >
                  <XOctagon /> Close card
                </Button>
              </div>

              {secrets?.billingAddress ? (
                <div className="rounded-2xl border border-gray-80 bg-white p-4 text-sm dark:border-white/10 dark:bg-secondary-50">
                  <p className="mb-1 text-xs font-semibold text-gray-30 dark:text-gray-40">
                    Billing address · {secrets.nameOnCard}
                  </p>
                  <p className="text-cryptoNight dark:text-white">
                    {[
                      secrets.billingAddress.line1,
                      secrets.billingAddress.line2,
                      [
                        secrets.billingAddress.city,
                        secrets.billingAddress.state,
                        secrets.billingAddress.postalCode,
                      ]
                        .filter(Boolean)
                        .join(" "),
                      secrets.billingAddress.country,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              ) : null}

              <div className="rounded-2xl border border-gray-80 bg-white dark:border-white/10 dark:bg-secondary-50">
                <p className="border-b border-gray-80 px-5 py-3 text-sm font-semibold text-cryptoNight dark:border-white/10 dark:text-white">
                  Activity
                </p>
                {activityQuery.data?.items.length ? (
                  <ul className="divide-y divide-gray-80 dark:divide-white/10">
                    {activityQuery.data.items.map((item) => {
                      const credit = CREDIT_TYPES.has(item.type);
                      const declined = item.type === "transaction.declined";
                      return (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-cryptoNight dark:text-white">
                              {item.merchantName ||
                                ACTIVITY_LABEL[item.type] ||
                                item.type}
                            </p>
                            <p
                              className={`truncate text-xs ${declined ? "text-rose-600 dark:text-rose-400" : "text-gray-30 dark:text-gray-40"}`}
                            >
                              {ACTIVITY_LABEL[item.type] ?? item.type}
                              {declined && item.description
                                ? ` · ${item.description}`
                                : ""}
                              {item.time
                                ? ` · ${new Date(item.time).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}`
                                : ""}
                            </p>
                          </div>
                          {item.amount != null ? (
                            <span
                              className={`shrink-0 font-semibold ${declined ? "text-gray-30 line-through" : credit ? "text-emerald-600 dark:text-emerald-400" : "text-cryptoNight dark:text-white"}`}
                            >
                              {credit ? "+" : "−"}
                              {money(Math.abs(Number(item.amount)))}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="px-5 py-6 text-sm text-gray-30 dark:text-gray-40">
                    No activity yet.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => !busy && !open && setDialog(null)}
      >
        <DialogContent className="border-gray-80 bg-gray-99 dark:border-white/10 dark:bg-secondary-40 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-cryptoNight dark:text-white">
              {dialog === "issue"
                ? "Get a virtual card"
                : dialog === "topup"
                  ? `Top up ••${card?.last4}`
                  : `Withdraw from ••${card?.last4}`}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-30 dark:text-gray-40">
              {dialog === "withdraw"
                ? `Paid to your Kellon wallet in ${program.payout.asset}. $1 must stay on the card.`
                : "Pay from your Kellon wallet. Your card is loaded once the payment confirms."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {dialog === "issue" ? (
              <div className="flex flex-wrap gap-2">
                {program.brands.map((b) => (
                  <Chip
                    key={b}
                    active={b === brand}
                    label={b}
                    onClick={() => setBrand(b)}
                  />
                ))}
              </div>
            ) : null}

            <div className="relative">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={
                  dialog === "withdraw" && card?.withdrawableBalance != null
                    ? `Up to ${card.withdrawableBalance}`
                    : "0.00"
                }
                className="h-14 border-gray-80 bg-white pr-14 text-xl font-bold text-cryptoNight dark:border-white/10 dark:bg-secondary-50 dark:text-white"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-20 dark:text-gray-40">
                USD
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-20 dark:text-gray-40">
                {dialog === "withdraw" ? "Receive on" : "Pay from"}
              </p>
              <div className="flex flex-wrap gap-2">
                {(dialog === "withdraw"
                  ? payoutChains
                  : program.funding.chains
                ).map((c) => (
                  <Chip
                    key={c}
                    active={c === chain}
                    label={CARD_CHAIN_LABELS[c] ?? c}
                    onClick={() => setChain(c)}
                  />
                ))}
              </div>
              {dialog !== "withdraw" ? (
                <div className="flex flex-wrap gap-2">
                  {program.funding.assets.map((a) => (
                    <Chip
                      key={a}
                      active={a === asset}
                      label={`${a} · ${getMaxUsableBalanceForChain(profile, a, chain).toFixed(2)}`}
                      onClick={() => setAsset(a)}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-1 rounded-lg bg-gray-90 p-3 text-xs dark:bg-secondary-60">
              {quote ? (
                dialog === "withdraw" ? (
                  <>
                    {Number(quote.kellonFeeUsd) > 0 ? (
                      <Row
                        label="Kellon fee"
                        value={money(quote.kellonFeeUsd)}
                      />
                    ) : null}
                    {Number(quote.owedUsd) > 0 ? (
                      <Row
                        label="Earlier card fees owed"
                        value={money(quote.owedUsd)}
                      />
                    ) : null}
                    <Row
                      label="You receive"
                      value={`${Number(quote.payoutUsd).toFixed(2)} ${program.payout.asset}`}
                      strong
                    />
                  </>
                ) : (
                  <>
                    <Row
                      label="Loaded on card"
                      value={money(quote.amountUsd)}
                    />
                    <Row
                      label={
                        dialog === "issue"
                          ? "Card issuing & funding fee"
                          : "Funding fee"
                      }
                      value={money(quote.providerFeeUsd)}
                    />
                    {Number(quote.kellonFeeUsd) > 0 ? (
                      <Row
                        label="Kellon fee"
                        value={money(quote.kellonFeeUsd)}
                      />
                    ) : null}
                    {Number(quote.owedUsd) > 0 ? (
                      <Row
                        label="Earlier card fees owed"
                        value={money(quote.owedUsd)}
                      />
                    ) : null}
                    <Row
                      label="You pay"
                      value={`${Number(quote.totalUsd).toFixed(2)} ${asset}`}
                      strong
                    />
                    {Number(quote.totalUsd) > balance ? (
                      <p className="pt-1 text-rose-600 dark:text-rose-400">
                        You have {balance.toFixed(2)} {asset} on{" "}
                        {CARD_CHAIN_LABELS[chain] ?? chain}.
                      </p>
                    ) : null}
                  </>
                )
              ) : (
                <p className="text-gray-30 dark:text-gray-40">
                  {quoteError || "Enter an amount to see the price."}
                </p>
              )}
            </div>

            {status ? (
              <p className="text-center text-xs text-gray-30 dark:text-gray-40">
                {status}
              </p>
            ) : null}

            <Button
              className="w-full"
              size="full"
              disabled={
                busy ||
                !quote ||
                (dialog !== "withdraw" && Number(quote.totalUsd) > balance)
              }
              onClick={() => (dialog === "withdraw" ? withdraw() : fund())}
            >
              {busy ? <Loader2 className="animate-spin" /> : null}
              {dialog === "withdraw"
                ? "Withdraw"
                : quote
                  ? `Pay ${Number(quote.totalUsd).toFixed(2)} ${asset}`
                  : "Pay"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TransferVerificationModal
        isOpen={Boolean(verification)}
        isSubmitting={busy}
        verificationType={verification?.type ?? "email_otp"}
        onClose={() => setVerification(null)}
        title="Confirm it's you"
        actionNoun="card action"
        description={
          verification?.type === "totp"
            ? "Enter the code from your authenticator app."
            : "Enter the one-time code we sent you."
        }
        onResend={() =>
          transferService
            .requestOTP(
              verification?.pending.context === "transfer"
                ? "transfer"
                : "card",
              "email",
            )
            .then(() => toast.success("Code sent"))
            .catch(() => toast.error("Could not send a code"))
        }
        otpSent
        onSubmit={(code) =>
          verification?.pending.run({
            verificationCode: code,
            verificationType: verification.type,
          })
        }
      />
    </section>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${strong ? "pt-1 font-bold text-cryptoNight dark:text-white" : "text-gray-20 dark:text-gray-30"}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
