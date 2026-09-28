"use client";

import { useEffect, useState } from "react";
import { Mail, MessageSquareText, ShieldCheck, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  getEnabledTransactionVerificationMethods,
  securityService,
} from "@/services/api/security";
import type { VerificationMethod } from "@/services/api/transfers";

interface TransferVerificationModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  verificationType: "email_otp" | "sms_otp" | "totp";
  onClose: () => void;
  onSubmit: (code: string) => void;
  title?: string;
  actionNoun?: string;
  description?: string;
  onResend?: () => void;
  isResending?: boolean;
  availableMethods?: VerificationMethod[];
  selectedMethod?: VerificationMethod;
  onMethodChange?: (method: VerificationMethod) => void;
  otpSent?: boolean;
}

export default function TransferVerificationModal({
  isOpen,
  isSubmitting,
  verificationType,
  onClose,
  onSubmit,
  title = "Confirm transfer",
  actionNoun = "send",
  description,
  onResend,
  isResending = false,
  availableMethods,
  selectedMethod,
  onMethodChange,
  otpSent = true,
}: TransferVerificationModalProps) {
  const [code, setCode] = useState("");
  const [enabledMethods, setEnabledMethods] = useState<
    VerificationMethod[] | null
  >(null);
  const [setupCode, setSetupCode] = useState("");
  const [setupSent, setSetupSent] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCode("");
      setSetupCode("");
      setSetupSent(false);
      setSetupError(null);
      return;
    }

    let cancelled = false;
    void securityService
      .getSettings()
      .then((settings) => {
        if (!cancelled) {
          setEnabledMethods(getEnabledTransactionVerificationMethods(settings));
        }
      })
      // Preserve the server challenge if security settings cannot be loaded.
      .catch(() => {
        if (!cancelled) setEnabledMethods(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const activeMethod = selectedMethod || verificationType;
  const challengeMethods = availableMethods?.length ? availableMethods : null;
  const methods = enabledMethods
    ? challengeMethods
      ? enabledMethods.filter((method) => challengeMethods.includes(method))
      : enabledMethods
    : challengeMethods || [activeMethod];
  const isOtpMethod = activeMethod !== "totp";
  const trimmedCode = code.trim();
  const canSubmit =
    trimmedCode.length >= 4 && !isSubmitting && (!isOtpMethod || otpSent);
  const showMethodPicker = methods.length > 1 && Boolean(onMethodChange);
  const isChoosingOtpChannel = isOtpMethod && !otpSent && Boolean(onResend);
  const methodLabel =
    activeMethod === "sms_otp"
      ? "SMS"
      : activeMethod === "totp"
        ? "Google Authenticator"
        : "email";

  useEffect(() => {
    setCode("");
  }, [activeMethod]);

  useEffect(() => {
    if (methods.length && !methods.includes(activeMethod) && onMethodChange) {
      onMethodChange(methods[0]);
    }
  }, [activeMethod, methods, onMethodChange]);

  const sendSetupCode = async () => {
    setIsSettingUp(true);
    setSetupError(null);
    try {
      await securityService.requestOtp("email", "enable_otp");
      setSetupSent(true);
    } catch (error) {
      setSetupError(
        error instanceof Error ? error.message : "Unable to send a setup code.",
      );
    } finally {
      setIsSettingUp(false);
    }
  };

  const completeEmailSetup = async () => {
    if (setupCode.trim().length < 4) return;
    setIsSettingUp(true);
    setSetupError(null);
    try {
      await securityService.enableOtp("email", setupCode.trim());
      setEnabledMethods(["email_otp"]);
      onMethodChange?.("email_otp");
      setSetupCode("");
      setSetupSent(false);
    } catch (error) {
      setSetupError(
        error instanceof Error
          ? error.message
          : "Unable to enable email verification.",
      );
    } finally {
      setIsSettingUp(false);
    }
  };

  const requiresSecuritySetup =
    enabledMethods !== null && enabledMethods.length === 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[380px] rounded-[32px] border-none bg-gray-70 p-0 outline-none dark:bg-black2 [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-95 text-primary-50 dark:bg-primary-70/15 dark:text-primary-80">
            <ShieldCheck className="h-5 w-5" />
          </div>

          <h2 className="text-lg font-semibold text-cryptoNight dark:text-white">
            {title}
          </h2>
          <p className="mx-auto mt-2 max-w-[280px] text-sm text-gray-20 dark:text-gray-40">
            {description ||
              (isOtpMethod && !otpSent
                ? activeMethod === "email_otp"
                  ? "We'll send a verification code to your email to authorize this transaction."
                  : showMethodPicker
                    ? "Choose a verification method, then request your code."
                    : `Request your ${methodLabel} code to complete this ${actionNoun}.`
                : `Enter your ${methodLabel} code to complete this ${actionNoun}.`)}
          </p>

          {requiresSecuritySetup ? (
            <div className="mt-5 rounded-xl border border-primary-90/30 bg-primary-99 p-4 text-left dark:border-primary-70/30 dark:bg-primary-70/10">
              <p className="text-sm font-semibold text-cryptoNight dark:text-white">
                Enable a verification method to continue
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-20 dark:text-gray-40">
                Enable email verification now. Your pending action will stay
                open and can continue afterwards.
              </p>
              {setupSent ? (
                <Input
                  value={setupCode}
                  onChange={(event) => setSetupCode(event.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Enter email code"
                  className="mt-3 h-11 rounded-xl border-black/5 bg-white text-center text-sm font-semibold tracking-[0.2em] text-cryptoNight placeholder:tracking-normal dark:border-white/10 dark:bg-secondary-60 dark:text-white"
                  disabled={isSettingUp}
                />
              ) : null}
              {setupError ? (
                <p className="mt-2 text-xs text-red-600 dark:text-red-300">
                  {setupError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={setupSent ? completeEmailSetup : sendSetupCode}
                disabled={
                  isSettingUp || (setupSent && setupCode.trim().length < 4)
                }
                className="mt-3 h-10 w-full rounded-xl bg-primary-50 text-sm font-semibold text-white transition hover:bg-primary-40 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-primary-70 dark:hover:bg-primary-80"
              >
                {isSettingUp
                  ? "Please wait..."
                  : setupSent
                    ? "Enable email verification"
                    : "Send setup code"}
              </button>
            </div>
          ) : showMethodPicker ? (
            <div className="mt-5 flex flex-wrap gap-2 rounded-xl bg-gray-90 p-1 dark:bg-secondary-60">
              {methods.map((method) => {
                const MethodIcon =
                  method === "sms_otp"
                    ? MessageSquareText
                    : method === "totp"
                      ? Smartphone
                      : Mail;
                const isSelected = activeMethod === method;
                const label =
                  method === "sms_otp"
                    ? "SMS"
                    : method === "totp"
                      ? "Authenticator"
                      : "Email";

                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => onMethodChange?.(method)}
                    disabled={isSubmitting || isResending}
                    className={`flex h-10 min-w-[92px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      isSelected
                        ? "bg-white text-primary-50 shadow-sm dark:bg-secondary-50 dark:text-primary-80"
                        : "text-gray-30 hover:text-cryptoNight dark:text-gray-40 dark:hover:text-white"
                    }`}
                    aria-pressed={isSelected}
                  >
                    <MethodIcon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          ) : null}

          {!requiresSecuritySetup && isOtpMethod && onResend && otpSent ? (
            <button
              type="button"
              onClick={() => onResend()}
              disabled={isSubmitting || isResending}
              className="mt-3 cursor-pointer text-xs font-semibold text-primary-50 transition hover:text-primary-30 disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-80 dark:hover:text-primary-90"
            >
              {isResending ? "Sending code..." : `Resend by ${methodLabel}`}
            </button>
          ) : null}

          {!requiresSecuritySetup && (!isOtpMethod || otpSent) ? (
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Enter code"
              className="mt-5 h-12 rounded-2xl border-black/5 bg-gray-95 text-center text-base font-semibold tracking-[0.35em] text-cryptoNight placeholder:tracking-normal placeholder:text-gray-400 focus-visible:ring-primary-70/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white"
              disabled={isSubmitting}
            />
          ) : null}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-11 rounded-xl border border-gray-80 bg-white text-sm font-semibold text-gray-20 transition hover:bg-gray-95 disabled:opacity-50 dark:border-white/10 dark:bg-secondary-50 dark:text-gray-40 dark:hover:bg-secondary-60 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={
                requiresSecuritySetup
                  ? undefined
                  : isChoosingOtpChannel
                    ? () => onResend?.()
                    : () => onSubmit(trimmedCode)
              }
              disabled={
                requiresSecuritySetup ||
                (isChoosingOtpChannel
                  ? isSubmitting || isResending
                  : !canSubmit)
              }
              className="h-11 rounded-xl bg-primary-50 text-sm font-semibold text-white transition hover:bg-primary-40 disabled:opacity-60 dark:bg-primary-70 dark:hover:bg-primary-80 cursor-pointer"
            >
              {requiresSecuritySetup
                ? "Set up verification"
                : isChoosingOtpChannel
                  ? isResending
                    ? "Sending..."
                    : activeMethod === "email_otp"
                      ? "Send code"
                      : `Send ${methodLabel} code`
                  : isSubmitting
                    ? "Confirming..."
                    : "Confirm"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
