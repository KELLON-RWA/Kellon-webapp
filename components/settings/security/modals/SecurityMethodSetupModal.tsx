"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SecuritySetup } from "../security-types";

interface SecurityMethodSetupModalProps {
  setup: SecuritySetup;
  isBusy: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (code: string) => Promise<void>;
}

export default function SecurityMethodSetupModal({
  setup,
  isBusy,
  isSubmitting,
  onClose,
  onSubmit,
}: SecurityMethodSetupModalProps) {
  const [code, setCode] = useState("");
  const [totpQrCode, setTotpQrCode] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setCode("");
    setTotpQrCode(null);

    if (setup?.kind !== "totp" || !setup.qrCodeUrl) {
      return () => {
        active = false;
      };
    }
    if (setup.qrCodeUrl.startsWith("data:image/")) {
      setTotpQrCode(setup.qrCodeUrl);
      return () => {
        active = false;
      };
    }

    void QRCode.toDataURL(setup.qrCodeUrl, { width: 220, margin: 1 }).then(
      (dataUrl) => active && setTotpQrCode(dataUrl),
    );
    return () => {
      active = false;
    };
  }, [setup]);

  return (
    <Dialog open={Boolean(setup)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-[28px] border-none bg-gray-70 dark:bg-black2">
        <DialogHeader>
          <DialogTitle>
            {setup?.kind === "totp"
              ? "Set up Google Authenticator"
              : `Enable ${setup?.channel === "sms" ? "SMS" : "email"} verification`}
          </DialogTitle>
          <DialogDescription>
            {setup?.kind === "totp"
              ? "Scan the QR code, then enter the current six-digit code."
              : `Enter the code sent${setup?.destination ? ` to ${setup.destination}` : " to you"}.`}
          </DialogDescription>
        </DialogHeader>

        {setup?.kind === "totp" ? (
          <div className="space-y-4 text-center">
            {totpQrCode ? (
              <Image
                src={totpQrCode}
                alt="Google Authenticator QR code"
                width={220}
                height={220}
                unoptimized
                className="mx-auto rounded-xl bg-white p-2"
              />
            ) : null}
            <div className="rounded-xl bg-gray-90 p-3 text-left dark:bg-secondary-60">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-30">
                Manual setup key
              </p>
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(setup.secret)
                    .then(() => toast.success("Setup key copied."))
                }
                className="mt-1 break-all text-left font-mono text-xs text-cryptoNight dark:text-white"
              >
                {setup.secret}
              </button>
            </div>
          </div>
        ) : null}

        <Input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="Enter verification code"
          className="h-12 rounded-xl text-center text-sm"
          disabled={isSubmitting}
        />
        <button
          type="button"
          onClick={() => void onSubmit(code)}
          disabled={code.trim().length < 4 || isBusy}
          className="h-12 cursor-pointer rounded-xl bg-primary-50 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-70"
        >
          {isSubmitting ? "Verifying…" : "Verify and enable"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
