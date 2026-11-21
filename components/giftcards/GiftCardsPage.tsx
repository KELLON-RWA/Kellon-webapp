"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallets } from "@privy-io/react-auth";
import { Copy, Gift, ImagePlus, Loader2, X } from "lucide-react";
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
  type CardVerification,
  type FundingOrder,
} from "@/services/api/cards";
import {
  giftCardsService,
  isFinalGiftOrder,
  type GiftBuyQuote,
  type GiftCode,
  type GiftOrder,
  type GiftProduct,
  type GiftSellQuote,
} from "@/services/api/giftcards";
import type { User } from "@/types/db";

type Tab = "buy" | "sell" | "orders";
type VerificationType = CardVerification["verificationType"];
type Pending = {
  run: (verification: CardVerification) => Promise<void>;
  context: "card" | "transfer";
};

const MAX_IMAGES = 6;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const money = (value?: number | string | null) =>
  value === null || value === undefined || value === ""
    ? "—"
    : `$${Number(value).toFixed(2)}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const verificationTypeFor = (methods?: string[]): VerificationType =>
  methods?.includes("totp")
    ? "totp"
    : methods?.includes("sms_otp")
      ? "sms_otp"
      : "email_otp";

const STATUS_LABEL: Record<string, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  PROCESSING: "Processing",
  SUBMITTED: "With our partner",
  HELD: "Under review",
  PAYOUT_PENDING: "Paying out",
  PAYOUT_SENT: "Paying out",
  COMPLETED: "Completed",
  REFUNDED: "Refunded",
  FAILED: "Failed",
  EXPIRED: "Expired",
  NEEDS_REVIEW: "Being checked",
};

const ELIGIBILITY_MESSAGE: Record<string, string> = {
  KYC_REQUIRED: "Verify your identity in Settings to use gift cards.",
  COUNTRY_NOT_SUPPORTED: "Gift cards aren't available in your country yet.",
};

/** Shrinks a photo to a JPEG under the upload limit; PDFs and small images pass through. */
const toDataUri = async (file: File): Promise<string> => {
  const read = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read the file"));
      reader.readAsDataURL(blob);
    });
  if (file.type === "application/pdf" || file.size <= MAX_IMAGE_BYTES) {
    if (file.size > MAX_IMAGE_BYTES)
      throw new Error(`${file.name} is over 4 MB`);
    return read(file);
  }
  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  for (let i = 0; i < 5; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (blob && blob.size <= MAX_IMAGE_BYTES) return read(blob);
    scale *= 0.7;
  }
  throw new Error(`${file.name} is too large`);
};

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

const panel =
  "rounded-2xl border border-gray-80 bg-white p-5 dark:border-white/10 dark:bg-secondary-50";
const field =
  "h-11 border-gray-80 bg-white dark:border-white/10 dark:bg-secondary-50";

export default function GiftCardsPage({ profile }: { profile: User }) {
  const queryClient = useQueryClient();
  const { wallets } = useWallets();
  const { getSmartAccountClient } = useSmartAccount();

  const [tab, setTab] = useState<Tab>("buy");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [verification, setVerification] = useState<{
    type: VerificationType;
    pending: Pending;
  } | null>(null);

  const [search, setSearch] = useState("");
  const [product, setProduct] = useState<GiftProduct | null>(null);
  const [unitPrice, setUnitPrice] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [chain, setChain] = useState("base");
  const [asset, setAsset] = useState("USDC");
  const [buyQuote, setBuyQuote] = useState<GiftBuyQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [categoryId, setCategoryId] = useState("");
  const [cardTypeId, setCardTypeId] = useState("");
  const [sellAmount, setSellAmount] = useState("");
  const [payoutChain, setPayoutChain] = useState("");
  const [images, setImages] = useState<{ name: string; uri: string }[]>([]);
  const [code, setCode] = useState("");
  const [sellQuote, setSellQuote] = useState<GiftSellQuote | null>(null);

  const [codes, setCodes] = useState<{
    order: GiftOrder;
    codes: GiftCode[];
  } | null>(null);

  const programQuery = useQuery({
    queryKey: ["giftcards-program"],
    queryFn: async () => (await giftCardsService.getProgram()).data,
  });
  const program = programQuery.data;
  const usable = Boolean(program?.enabled && !program.eligibility);

  const productsQuery = useQuery({
    queryKey: ["giftcards-products"],
    queryFn: async () => (await giftCardsService.products()).data,
    enabled: usable && program?.buyEnabled && tab === "buy",
  });
  const categoriesQuery = useQuery({
    queryKey: ["giftcards-categories"],
    queryFn: async () => (await giftCardsService.sellCategories()).data,
    enabled: usable && program?.sellEnabled && tab === "sell",
  });
  const cardTypesQuery = useQuery({
    queryKey: ["giftcards-card-types", categoryId],
    queryFn: async () =>
      (await giftCardsService.sellCardTypes(categoryId)).data,
    enabled: Boolean(usable && categoryId),
  });
  const ordersQuery = useQuery({
    queryKey: ["giftcards-orders"],
    queryFn: async () => (await giftCardsService.orders()).data,
    enabled: usable,
  });

  const products = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (productsQuery.data ?? []).filter(
      (p) => !term || p.title.toLowerCase().includes(term),
    );
  }, [productsQuery.data, search]);
  const cardType =
    cardTypesQuery.data?.find((t) => t.id === cardTypeId) ?? null;

  useEffect(() => {
    if (!program) return;
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
    setPayoutChain((c) =>
      program.payout.chains.includes(c) ? c : (program.payout.chains[0] ?? ""),
    );
  }, [program]);

  useEffect(() => {
    setUnitPrice(product?.fixedPrices[0] ? String(product.fixedPrices[0]) : "");
    setQuantity(1);
  }, [product]);

  useEffect(() => {
    const price = Number(unitPrice);
    if (!product || !(price > 0)) {
      setBuyQuote(null);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      giftCardsService
        .quoteBuy({
          sku: product.sku,
          unitPrice: price,
          quantity,
          chain,
          asset,
        })
        .then((res) => live && (setBuyQuote(res.data), setQuoteError(null)))
        .catch(
          (error: Error) =>
            live && (setBuyQuote(null), setQuoteError(error.message)),
        );
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [product, unitPrice, quantity, chain, asset]);

  useEffect(() => {
    const amount = Number(sellAmount);
    if (!categoryId || !cardTypeId || !(amount > 0)) {
      setSellQuote(null);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      giftCardsService
        .quoteSell({
          categoryId,
          cardTypeId,
          amount,
          payoutChain: payoutChain || undefined,
        })
        .then((res) => live && (setSellQuote(res.data), setQuoteError(null)))
        .catch(
          (error: Error) =>
            live && (setSellQuote(null), setQuoteError(error.message)),
        );
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [categoryId, cardTypeId, sellAmount, payoutChain]);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]).startsWith("giftcards-"),
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

  const guarded = async (
    run: (v?: CardVerification) => Promise<void>,
    v?: CardVerification,
  ) => {
    setBusy(true);
    try {
      await run(v);
      setVerification(null);
    } catch (error) {
      if (
        !challenge(error, {
          run: (next) => guarded(run, next),
          context: "card",
        })
      ) {
        toast.error(
          error instanceof Error ? error.message : "Something went wrong",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const payOrder = async (order: FundingOrder): Promise<GiftOrder> => {
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
    let op = (await giftCardsService.confirmPayment(order.operation.id, txHash))
      .data;
    const started = Date.now();
    while (!isFinalGiftOrder(op.status) && Date.now() - started < 180_000) {
      setStatus(
        op.status === "AWAITING_PAYMENT"
          ? "Confirming your payment…"
          : "Getting your gift card…",
      );
      await sleep(4000);
      op = (await giftCardsService.order(op.id)).data;
    }
    return op;
  };

  const buy = async (transferVerification?: CardVerification) => {
    if (!product || !buyQuote) return;
    const balance = getMaxUsableBalanceForChain(profile, asset, chain);
    if (Number(buyQuote.totalUsd) > balance) {
      toast.error(
        `You need ${Number(buyQuote.totalUsd).toFixed(2)} ${asset} on ${CARD_CHAIN_LABELS[chain] ?? chain}.`,
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
      const order = (
        await giftCardsService.buy({
          sku: product.sku,
          unitPrice: Number(unitPrice),
          quantity,
          chain,
          asset,
        })
      ).data;
      const op = await payOrder(order);
      endOperation();
      if (op.status === "COMPLETED")
        toast.success("Your gift card is ready. Open it under My orders.");
      else if (
        op.status === "REFUNDED" ||
        op.status === "PAYOUT_PENDING" ||
        op.status === "PAYOUT_SENT"
      )
        toast.error(
          "The gift card couldn't be bought; your payment is being refunded.",
        );
      else if (op.status === "FAILED" || op.status === "EXPIRED")
        toast.error(op.error || "This order did not go through.");
      else
        toast.success(
          "Payment confirmed. We'll notify you when your gift card is ready.",
        );
      setProduct(null);
      setVerification(null);
      setTab("orders");
      refresh();
    } catch (error) {
      endOperation();
      if (!challenge(error, { run: (v) => buy(v), context: "transfer" }))
        toast.error(error instanceof Error ? error.message : "Payment failed");
    } finally {
      setStickyVerificationCode(null);
      setBusy(false);
      setStatus("");
    }
  };

  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0)
      return toast.error(`You can add at most ${MAX_IMAGES} photos.`);
    try {
      const added = await Promise.all(
        Array.from(files)
          .slice(0, room)
          .map(async (f) => ({ name: f.name, uri: await toDataUri(f) })),
      );
      setImages((current) => [...current, ...added]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add that photo",
      );
    }
  };

  const sell = () =>
    guarded(async (v) => {
      if (!images.length && !code.trim())
        throw new Error("Add photos of the card, or its code for an e-code.");
      await giftCardsService.sell(
        {
          categoryId,
          cardTypeId,
          amount: Number(sellAmount),
          payoutChain: payoutChain || undefined,
          images: images.map((i) => i.uri),
          comments: code.trim() || undefined,
        },
        v,
      );
      toast.success(
        "Your card is with our partner for checking. You'll be paid once it's accepted.",
      );
      setImages([]);
      setCode("");
      setSellAmount("");
      setTab("orders");
      refresh();
    });

  const showCodes = (order: GiftOrder) =>
    guarded(async (v) => {
      setCodes({
        order,
        codes: (await giftCardsService.codes(order.id, v)).data,
      });
    });

  if (programQuery.isLoading) {
    return (
      <section className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary-50" />
      </section>
    );
  }

  if (!program?.enabled || program.eligibility) {
    return (
      <section className="mx-auto max-w-xl space-y-4 py-10 text-center">
        <Gift className="mx-auto size-10 text-primary-50" />
        <h1 className="text-2xl font-bold text-cryptoNight dark:text-white">
          Gift cards
        </h1>
        <p className="text-sm text-gray-30 dark:text-gray-40">
          {program?.eligibility
            ? (ELIGIBILITY_MESSAGE[program.eligibility] ??
              "Gift cards aren't available for your account yet.")
            : "Gift cards are coming soon."}
        </p>
      </section>
    );
  }

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "buy", label: "Buy", show: program.buyEnabled },
    { key: "sell", label: "Sell", show: program.sellEnabled },
    { key: "orders", label: "My orders", show: true },
  ];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-cryptoNight dark:text-white">
          Gift cards
        </h1>
        <p className="text-sm text-gray-30 dark:text-gray-40">
          Buy gift cards with your crypto, or sell gift cards you own for USDC.
        </p>
      </div>

      <div className="flex gap-2">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <Chip
              key={t.key}
              active={tab === t.key}
              label={t.label}
              onClick={() => setTab(t.key)}
            />
          ))}
      </div>

      {tab === "buy" && (
        <div className="space-y-4">
          <Input
            className={`${field} max-w-sm`}
            placeholder="Search gift cards"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {productsQuery.isLoading ? (
            <Loader2 className="size-5 animate-spin text-primary-50" />
          ) : products.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <button
                  key={p.sku}
                  type="button"
                  onClick={() => setProduct(p)}
                  className={`${panel} flex flex-col items-start gap-2 text-left transition hover:border-primary-50`}
                >
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt=""
                      className="h-12 w-auto object-contain"
                    />
                  ) : (
                    <Gift className="size-8 text-primary-50" />
                  )}
                  <span className="text-sm font-semibold text-cryptoNight dark:text-white">
                    {p.title}
                  </span>
                  <span className="text-xs text-gray-30 dark:text-gray-40">
                    {p.currency}
                    {p.country ? ` · ${p.country}` : ""}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-30 dark:text-gray-40">
              No gift cards match.
            </p>
          )}
        </div>
      )}

      {tab === "sell" && (
        <div className={`${panel} max-w-xl space-y-4`}>
          <div className="flex flex-wrap gap-2">
            {(categoriesQuery.data ?? []).map((c) => (
              <Chip
                key={c.id}
                active={c.id === categoryId}
                label={c.name}
                onClick={() => {
                  setCategoryId(c.id);
                  setCardTypeId("");
                }}
              />
            ))}
            {categoriesQuery.isLoading ? (
              <Loader2 className="size-5 animate-spin text-primary-50" />
            ) : null}
          </div>
          {categoryId ? (
            <select
              className={`${field} w-full rounded-md border px-3 text-sm`}
              value={cardTypeId}
              onChange={(e) => setCardTypeId(e.target.value)}
            >
              <option value="">Choose the card type</option>
              {(cardTypesQuery.data ?? []).map((t) => (
                <option key={`${t.id}-${t.name}`} value={t.id}>
                  {t.name}
                  {t.form ? ` · ${t.form}` : ""}
                </option>
              ))}
            </select>
          ) : null}
          {cardType ? (
            <>
              {cardType.terms ? (
                <p className="text-xs text-gray-30 dark:text-gray-40">
                  {cardType.terms}
                </p>
              ) : null}
              <Input
                className={field}
                inputMode="decimal"
                placeholder={`Card value in ${cardType.currency}${cardType.minAmount ? ` (from ${cardType.minAmount})` : ""}`}
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
              />
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-primary-50">
                  <ImagePlus className="size-4" /> Add photos of the card (front
                  and back, with receipt if needed)
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addImages(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  {images.map((img, i) => (
                    <span
                      key={`${img.name}-${i}`}
                      className="flex items-center gap-1 rounded-full bg-gray-90 px-3 py-1 text-xs dark:bg-secondary-60"
                    >
                      {img.name}
                      <button
                        type="button"
                        onClick={() =>
                          setImages((list) => list.filter((_, j) => j !== i))
                        }
                        aria-label={`Remove ${img.name}`}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <Input
                  className={field}
                  placeholder="Or the card's code, for e-codes"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {program.payout.chains.map((c) => (
                  <Chip
                    key={c}
                    active={c === payoutChain}
                    label={`Paid on ${CARD_CHAIN_LABELS[c] ?? c}`}
                    onClick={() => setPayoutChain(c)}
                  />
                ))}
              </div>
              <div className="space-y-1 rounded-lg bg-gray-90 p-3 text-xs dark:bg-secondary-60">
                {sellQuote ? (
                  <>
                    <Row
                      label="Estimated value"
                      value={money(sellQuote.estimatedUsd)}
                    />
                    {Number(sellQuote.kellonFeeUsd) > 0 ? (
                      <Row
                        label="Kellon fee"
                        value={money(sellQuote.kellonFeeUsd)}
                      />
                    ) : null}
                    {Number(sellQuote.owedUsd) > 0 ? (
                      <Row
                        label="Card fees you owe"
                        value={money(sellQuote.owedUsd)}
                      />
                    ) : null}
                    <Row
                      label="You receive (estimate)"
                      value={`${Number(sellQuote.estimatedPayoutUsd).toFixed(2)} ${sellQuote.payoutAsset}`}
                      strong
                    />
                    <p className="pt-1 text-gray-30 dark:text-gray-40">
                      The final amount is set when our partner accepts the card,
                      at that day&apos;s rate.
                    </p>
                  </>
                ) : (
                  <p className="text-gray-30 dark:text-gray-40">
                    {quoteError ?? "Enter the card's value to see an estimate."}
                  </p>
                )}
              </div>
              <Button
                className="w-full"
                disabled={busy || !sellQuote}
                onClick={sell}
              >
                {busy ? <Loader2 className="animate-spin" /> : null} Sell gift
                card
              </Button>
            </>
          ) : null}
        </div>
      )}

      {tab === "orders" && (
        <div className="space-y-3">
          {ordersQuery.isLoading ? (
            <Loader2 className="size-5 animate-spin text-primary-50" />
          ) : ordersQuery.data?.length ? (
            ordersQuery.data.map((o) => (
              <div
                key={o.id}
                className={`${panel} flex flex-wrap items-center justify-between gap-3`}
              >
                <div>
                  <p className="text-sm font-semibold text-cryptoNight dark:text-white">
                    {o.side === "BUY" ? "Bought" : "Sold"} ·{" "}
                    {o.giftCard.title ?? "Gift card"}
                  </p>
                  <p className="text-xs text-gray-30 dark:text-gray-40">
                    {new Date(o.createdAt).toLocaleString()} ·{" "}
                    {STATUS_LABEL[o.status] ?? o.status}
                    {o.side === "BUY"
                      ? ` · paid ${money(o.totalUsd)}`
                      : o.payoutUsd
                        ? ` · received ${money(o.payoutUsd)}`
                        : o.giftCard.estimatedUsd
                          ? ` · est. ${money(o.giftCard.estimatedUsd)}`
                          : ""}
                  </p>
                  {o.error && ["FAILED", "REFUNDED"].includes(o.status) ? (
                    <p className="text-xs text-rose-500">{o.error}</p>
                  ) : null}
                </div>
                {o.giftCard.codesReady ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => showCodes(o)}
                  >
                    Show code
                  </Button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-30 dark:text-gray-40">
              No gift card orders yet.
            </p>
          )}
        </div>
      )}

      <Dialog
        open={Boolean(product)}
        onOpenChange={(open) => !open && !busy && setProduct(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{product?.title}</DialogTitle>
            <DialogDescription>
              Choose the card value in {product?.currency}. You pay in {asset};
              the price is fixed once you pay.
            </DialogDescription>
          </DialogHeader>
          {product ? (
            <div className="space-y-4">
              {product.fixedPrices.length ? (
                <div className="flex flex-wrap gap-2">
                  {product.fixedPrices.map((v) => (
                    <Chip
                      key={v}
                      active={String(v) === unitPrice}
                      label={`${v} ${product.currency}`}
                      onClick={() => setUnitPrice(String(v))}
                    />
                  ))}
                </div>
              ) : (
                <Input
                  className={field}
                  inputMode="decimal"
                  placeholder={`${product.minPrice ?? ""}–${product.maxPrice ?? ""} ${product.currency}`}
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                />
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-30 dark:text-gray-40">Quantity</span>
                {[1, 2, 3, 5].map((q) => (
                  <Chip
                    key={q}
                    active={q === quantity}
                    label={String(q)}
                    onClick={() => setQuantity(q)}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {program.funding.chains.map((c) => (
                  <Chip
                    key={c}
                    active={c === chain}
                    label={CARD_CHAIN_LABELS[c] ?? c}
                    onClick={() => setChain(c)}
                  />
                ))}
              </div>
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
              <div className="space-y-1 rounded-lg bg-gray-90 p-3 text-xs dark:bg-secondary-60">
                {buyQuote ? (
                  <>
                    <Row
                      label="Gift card price"
                      value={money(buyQuote.providerUsd)}
                    />
                    {Number(buyQuote.kellonFeeUsd) > 0 ? (
                      <Row
                        label="Kellon fee"
                        value={money(buyQuote.kellonFeeUsd)}
                      />
                    ) : null}
                    <Row
                      label="You pay"
                      value={`${Number(buyQuote.totalUsd).toFixed(2)} ${asset}`}
                      strong
                    />
                  </>
                ) : (
                  <p className="text-gray-30 dark:text-gray-40">
                    {quoteError ?? "Choose a value to see the price."}
                  </p>
                )}
              </div>
              {status ? (
                <p className="text-xs text-gray-30 dark:text-gray-40">
                  {status}
                </p>
              ) : null}
              <Button
                className="w-full"
                disabled={busy || !buyQuote}
                onClick={() => buy()}
              >
                {busy ? <Loader2 className="animate-spin" /> : null}
                {buyQuote
                  ? `Pay ${Number(buyQuote.totalUsd).toFixed(2)} ${asset}`
                  : "Pay"}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(codes)}
        onOpenChange={(open) => !open && setCodes(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {codes?.order.giftCard.title ?? "Your gift card"}
            </DialogTitle>
            <DialogDescription>
              Keep these private. Anyone with the code can spend the card.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {codes?.codes.map((c, i) => (
              <div
                key={i}
                className="space-y-1 rounded-lg bg-gray-90 p-3 text-sm dark:bg-secondary-60"
              >
                {(["cardNumber", "pin"] as const).map((k) =>
                  c[k] ? (
                    <div
                      key={k}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-xs text-gray-30 dark:text-gray-40">
                        {k === "pin" ? "PIN" : "Code"}
                      </span>
                      <button
                        type="button"
                        className="flex items-center gap-1 font-mono font-semibold text-cryptoNight dark:text-white"
                        onClick={() => {
                          navigator.clipboard.writeText(c[k]!);
                          toast.success("Copied");
                        }}
                      >
                        {c[k]} <Copy className="size-3" />
                      </button>
                    </div>
                  ) : null,
                )}
                {c.claimUrl ? (
                  <a
                    href={c.claimUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-primary-50 underline"
                  >
                    Open the card
                  </a>
                ) : null}
                {c.expiryDate ? (
                  <p className="text-xs text-gray-30 dark:text-gray-40">
                    Expires {c.expiryDate}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <TransferVerificationModal
        isOpen={Boolean(verification)}
        isSubmitting={busy}
        verificationType={verification?.type ?? "email_otp"}
        onClose={() => setVerification(null)}
        title="Confirm it's you"
        actionNoun="gift card action"
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
        onSubmit={(c) =>
          verification?.pending.run({
            verificationCode: c,
            verificationType: verification.type,
          })
        }
      />
    </section>
  );
}
