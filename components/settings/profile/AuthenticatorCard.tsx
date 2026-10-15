"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronRight, Copy, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import TransferVerificationModal from "@/components/wallet/send/TransferVerificationModal";
import { findTransferVerificationRequiredError } from "@/services/api/transfers";
import {
  securityService,
  type StepUpCode,
  type TotpSetup,
} from "@/services/api/security";

type StepUpRequest = {
  verificationType: StepUpCode["verificationType"];
  retry: (stepUp: StepUpCode) => Promise<void>;
};

const APPS =
  "Google Authenticator, Microsoft Authenticator, Authy, 1Password or any other TOTP app";

export function AuthenticatorCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [code, setCode] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [stepUp, setStepUp] = useState<StepUpRequest | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(false);
    try {
      const settings = await securityService.getSettings();
      setEnabled(settings.totpEnabled);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Runs an action, asking for a step-up code first when the backend demands one. */
  const withStepUp = async (action: (stepUp?: StepUpCode) => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      const required = findTransferVerificationRequiredError(error);
      if (!required) throw error;
      setStepUp({ verificationType: required.verificationType, retry: action });
    }
  };

  const startSetup = async () => {
    setIsBusy(true);
    try {
      await withStepUp(async (code?: StepUpCode) => {
        const { data } = await securityService.setupTotp(code);
        setSetup(data);
        setStepUp(null);
        setIsOpen(true);
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not start setup.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const confirmSetup = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsBusy(true);
    try {
      await securityService.enableTotp(code);
      toast.success("Authenticator app enabled");
      setIsOpen(false);
      setSetup(null);
      setCode("");
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "That code didn't match.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const disable = async () => {
    setIsBusy(true);
    try {
      await withStepUp(async (code?: StepUpCode) => {
        await securityService.disableTotp(code);
        setStepUp(null);
        toast.success("Authenticator app disabled");
        await refresh();
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not disable it.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const submitStepUp = async (verificationCode: string) => {
    if (!stepUp) return;
    setIsBusy(true);
    try {
      await stepUp.retry({
        verificationCode,
        verificationType: stepUp.verificationType,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Verification failed.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <div className="flex w-full items-center justify-between rounded-[24px] border border-slate-100 bg-white p-5 dark:border-white/10 dark:bg-secondary-50">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-slate-100 p-3 text-primary-70 dark:bg-[#1a1f2e]">
            <KeyRound className="h-6 w-6" />
          </div>
          <div className="text-left">
            <h4 className="font-semibold text-slate-900 dark:text-white">
              Authenticator App
            </h4>
            <p className="text-xs text-slate-500 dark:text-gray-400">
              {loadError
                ? "Unable to load security settings. Please retry."
                : enabled === null
                  ? "Loading..."
                  : enabled
                    ? "On. Codes required for payments."
                    : "Off. Add one for extra payment security."}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={isBusy || (enabled === null && !loadError)}
          onClick={loadError ? refresh : enabled ? disable : startSetup}
          className="flex cursor-pointer items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-primary-70 hover:bg-primary-70/10 disabled:opacity-50"
        >
          {isBusy && !isOpen ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : loadError ? (
            "Retry"
          ) : enabled ? (
            "Disable"
          ) : (
            <>
              Set up <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setSetup(null);
            setCode("");
          }
        }}
      >
        <DialogContent className="rounded-[32px] border-none bg-gray-70 sm:max-w-md dark:bg-black2">
          <DialogHeader>
            <DialogTitle>Set up your authenticator app</DialogTitle>
            <DialogDescription>
              Scan the code with {APPS}, then enter the 6-digit code it shows.
            </DialogDescription>
          </DialogHeader>
          {setup ? (
            <form onSubmit={confirmSetup} className="space-y-4">
              {setup.qrCodeUrl ? (
                <div className="flex justify-center rounded-2xl bg-white p-4">
                  <Image
                    src={setup.qrCodeUrl}
                    alt="Authenticator QR code"
                    width={200}
                    height={200}
                    unoptimized
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Or enter this setup key
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(setup.secret)
                      .then(() => toast.success("Setup key copied"))
                      .catch(() => {});
                  }}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-2xl border border-black/5 bg-white px-4 py-3 font-mono text-sm break-all dark:border-white/10 dark:bg-secondary-60"
                >
                  {setup.secret}
                  <Copy className="h-4 w-4 shrink-0 text-gray-400" />
                </button>
              </div>
              <Input
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="h-12 rounded-2xl text-center text-lg tracking-[0.5em]"
              />
              <button
                type="submit"
                disabled={isBusy || code.length !== 6}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-70 to-primary-60 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                Verify and turn on
              </button>
            </form>
          ) : (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary-70" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TransferVerificationModal
        isOpen={stepUp !== null}
        isSubmitting={isBusy}
        verificationType={stepUp?.verificationType || "email_otp"}
        onClose={() => setStepUp(null)}
        onSubmit={submitStepUp}
        title="Confirm it's you"
        actionNoun="security change"
      />
    </>
  );
}
