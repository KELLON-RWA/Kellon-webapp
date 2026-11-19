"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MoneyGramFunding,
  MoneyGramSession,
  OfframpVerificationRequiredError,
  offrampService,
} from "@/services/api/off-ramp";

interface RampsInstance {
  open(): void;
  close(): void;
  destroy(): void;
}

declare global {
  interface Window {
    RampsSDK?: {
      createRamps: (config: Record<string, unknown>) => RampsInstance;
    };
  }
}

type PendingSign = {
  rampsTransactionId: string;
  resolve: (txHash: string) => void;
  reject: (error: Error) => void;
};

type Verification = {
  verificationType: "email_otp" | "sms_otp" | "totp";
};

const FUNDING_POLL_MS = 3000;
const FUNDING_TIMEOUT_MS = 3 * 60 * 1000;

const loadSdk = (origin: string) =>
  new Promise<void>((resolve, reject) => {
    if (window.RampsSDK) return resolve();
    const src = `${origin}/sdk/index.global.js`;
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("MoneyGram could not be loaded")),
      { once: true },
    );
    if (!existing) {
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }
  });

const waitForHash = async (rampsTransactionId: string) => {
  const deadline = Date.now() + FUNDING_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, FUNDING_POLL_MS));
    const res = await offrampService
      .getMoneyGramFunding(rampsTransactionId)
      .catch(() => null);
    if (res?.data?.txHash) return res.data.txHash;
  }
  throw new Error(
    "The transfer is still confirming. Check your transactions shortly.",
  );
};

export function MoneyGramWidget({
  open,
  onClose,
  onFinished,
}: {
  open: boolean;
  onClose: () => void;
  onFinished?: (referenceNumber?: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rampsRef = useRef<RampsInstance | null>(null);
  const createdRef = useRef<{ id: string; mgiTransactionId?: string } | null>(
    null,
  );
  const pendingRef = useRef<PendingSign | null>(null);
  const [loading, setLoading] = useState(false);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fund = async (
    pending: PendingSign,
    verificationInput?: { verificationCode: string; verificationType: string },
  ) => {
    try {
      const res = await offrampService.fundMoneyGram(
        pending.rampsTransactionId,
        {
          mgiTransactionId: createdRef.current?.mgiTransactionId,
          ...verificationInput,
        },
      );
      const funding = res.data as MoneyGramFunding;
      const txHash =
        funding.txHash ?? (await waitForHash(pending.rampsTransactionId));
      pendingRef.current = null;
      setVerification(null);
      pending.resolve(txHash);
    } catch (error) {
      if (error instanceof OfframpVerificationRequiredError) {
        setVerification({ verificationType: error.verificationType });
        return;
      }
      pendingRef.current = null;
      setVerification(null);
      const message =
        error instanceof Error ? error.message : "Unable to send funds";
      toast.error(message);
      pending.reject(new Error(message));
    }
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await offrampService.initiateMoneyGram();
        const session = res.data as MoneyGramSession;
        await loadSdk(new URL(session.widgetUrl).origin);
        if (cancelled || !containerRef.current || !window.RampsSDK) return;

        rampsRef.current = window.RampsSDK.createRamps({
          container: containerRef.current,
          sessionToken: session.sessionToken,
          widgetUrl: session.widgetUrl,
          wallet: {
            address: session.walletAddress,
            chain: "stellar",
            asset: "USDC",
            walletType: "non-custodial",
            displayName: "Kellon",
          },
          onTransactionCreated: (tx: {
            id: string;
            mgiTransactionId?: string;
          }) => {
            createdRef.current = {
              id: tx.id,
              mgiTransactionId: tx.mgiTransactionId,
            };
          },
          // The payload is ignored on purpose: the backend reads the deposit details from MoneyGram.
          onSignTransaction: () =>
            new Promise<string>((resolve, reject) => {
              const rampsTransactionId = createdRef.current?.id;
              if (!rampsTransactionId) {
                reject(new Error("MoneyGram transaction is missing"));
                return;
              }
              const pending = { rampsTransactionId, resolve, reject };
              pendingRef.current = pending;
              void fund(pending);
            }),
          onComplete: (tx: { referenceNumber?: string }) => {
            toast.success("Cash-out ready for pickup");
            onFinished?.(tx.referenceNumber);
          },
          onError: (err: { reason?: string }) => {
            if (err?.reason) toast.error(err.reason);
          },
          onClose,
        });
        rampsRef.current.open();
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "MoneyGram is unavailable",
          );
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      rampsRef.current?.destroy();
      rampsRef.current = null;
      pendingRef.current?.reject(new Error("Closed"));
      pendingRef.current = null;
      createdRef.current = null;
      setVerification(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submitCode = async () => {
    const pending = pendingRef.current;
    if (!pending || !verification || !code.trim()) return;
    setSubmitting(true);
    await fund(pending, {
      verificationCode: code.trim(),
      verificationType: verification.verificationType,
    });
    setCode("");
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>MoneyGram cash pickup</DialogTitle>
          <DialogDescription>
            Send USDC from your Stellar wallet and collect cash at a MoneyGram
            location.
          </DialogDescription>
        </DialogHeader>
        {verification && (
          <div className="space-y-2 px-4">
            <p className="text-sm">
              {verification.verificationType === "totp"
                ? "Enter your authenticator code to send the funds."
                : "Enter the code we sent you to send the funds."}
            </p>
            <div className="flex gap-2">
              <Input
                value={code}
                inputMode="numeric"
                autoComplete="one-time-code"
                onChange={(event) => setCode(event.target.value)}
              />
              <Button
                onClick={submitCode}
                disabled={submitting || !code.trim()}
              >
                Confirm
              </Button>
            </div>
          </div>
        )}
        {loading && (
          <p className="px-4 pb-4 text-sm text-muted-foreground">
            Loading MoneyGram…
          </p>
        )}
        <div ref={containerRef} className="h-[640px] w-full" />
      </DialogContent>
    </Dialog>
  );
}
