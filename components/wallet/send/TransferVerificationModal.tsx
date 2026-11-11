"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Check,
  Copy,
  Loader2,
  Mail,
  MessageSquareText,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getEnabledTransactionVerificationMethods,
  securityService,
  type TotpSetupResult,
} from "@/services/api/security";
import type { VerificationMethod } from "@/services/api/transfers";

interface TransferVerificationModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  verificationType: "email_otp" | "sms_otp" | "totp";
  onClose: () => void;
  onSubmit: (code: string, method?: VerificationMethod) => void;
  title?: string;
  actionNoun?: string;
  description?: string;
  onResend?: () => void;
  isResending?: boolean;
  availableMethods?: VerificationMethod[];
  selectedMethod?: VerificationMethod;
  onMethodChange?: (method: VerificationMethod) => void;
  otpSent?: boolean;
  errorMessage?: string | null;
  onClearError?: () => void;
}

export default function TransferVerificationModal({
  isOpen,
  isSubmitting,
  verificationType,
  onClose,
  onSubmit,
  title = "Confirm transfer",
  description,
  onResend,
  isResending = false,
  availableMethods,
  selectedMethod,
  onMethodChange,
  errorMessage,
  onClearError,
}: TransferVerificationModalProps) {
  const [code, setCode] = useState("");
  const [enabledMethods, setEnabledMethods] = useState<
    VerificationMethod[] | null
  >(null);

  // Setup mode states (when user has zero 2FA methods enabled)
  const [setupChannel, setSetupChannel] = useState<"totp" | "email">("totp");
  const [totpSetup, setTotpSetup] = useState<TotpSetupResult | null>(null);
  const [isGeneratingTotp, setIsGeneratingTotp] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [totpCopied, setTotpCopied] = useState(false);

  const [emailSetupCode, setEmailSetupCode] = useState("");
  const [emailSetupSent, setEmailSetupSent] = useState(false);

  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const requiresSecuritySetup =
    enabledMethods !== null && enabledMethods.length === 0;

  const loadTotpSetup = useCallback(async () => {
    setIsGeneratingTotp(true);
    setSetupError(null);
    try {
      const res = await securityService.setupTotp(false);
      setTotpSetup(res.data);
    } catch (err) {
      setSetupError(
        err instanceof Error
          ? err.message
          : "Failed to generate Authenticator setup key.",
      );
    } finally {
      setIsGeneratingTotp(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setCode("");
      setSetupChannel("totp");
      setTotpSetup(null);
      setIsGeneratingTotp(false);
      setTotpCode("");
      setTotpCopied(false);
      setEmailSetupCode("");
      setEmailSetupSent(false);
      setIsSettingUp(false);
      setSetupError(null);
      onClearError?.();
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
  }, [isOpen, onClearError]);

  // When setup mode is active and user is on TOTP channel, automatically load TOTP setup
  useEffect(() => {
    if (
      isOpen &&
      requiresSecuritySetup &&
      setupChannel === "totp" &&
      !totpSetup &&
      !isGeneratingTotp
    ) {
      void loadTotpSetup();
    }
  }, [isOpen, requiresSecuritySetup, setupChannel, totpSetup, isGeneratingTotp, loadTotpSetup]);

  const activeMethod = selectedMethod || verificationType;
  const challengeMethods = availableMethods?.length ? availableMethods : null;
  const methods = useMemo(
    () =>
      enabledMethods
        ? challengeMethods
          ? enabledMethods.filter((method) => challengeMethods.includes(method))
          : enabledMethods
        : challengeMethods || [activeMethod],
    [activeMethod, challengeMethods, enabledMethods],
  );
  const isOtpMethod = activeMethod !== "totp";
  const trimmedCode = code.replace(/\D/g, "").slice(0, 6);
  const canSubmit = trimmedCode.length === 6 && !isSubmitting;
  const showMethodPicker = methods.length > 1 && Boolean(onMethodChange);

  useEffect(() => {
    setCode("");
    onClearError?.();
  }, [activeMethod, onClearError]);

  useEffect(() => {
    if (methods.length && !methods.includes(activeMethod) && onMethodChange) {
      onMethodChange(methods[0]);
    }
  }, [activeMethod, methods, onMethodChange]);

  const completeTotpSetup = async () => {
    const cleaned = totpCode.replace(/\D/g, "");
    if (cleaned.length !== 6) return;
    setIsSettingUp(true);
    setSetupError(null);
    try {
      await securityService.enableTotp(cleaned);
      toast.success("Authenticator app enabled!");
      setEnabledMethods(["totp"]);
      onMethodChange?.("totp");
      onSubmit(cleaned, "totp");
    } catch (error) {
      setSetupError(
        error instanceof Error
          ? error.message
          : "Invalid code. Please check your authenticator app and try again.",
      );
    } finally {
      setIsSettingUp(false);
    }
  };

  const sendEmailSetupCode = async () => {
    setIsSettingUp(true);
    setSetupError(null);
    try {
      const res = await securityService.requestOtp("email", "enable_otp");
      setEmailSetupSent(true);
      toast.success(res.data?.message || "Verification code sent to your email.");
    } catch (error) {
      setSetupError(
        error instanceof Error ? error.message : "Unable to send a setup code.",
      );
    } finally {
      setIsSettingUp(false);
    }
  };

  const completeEmailSetup = async () => {
    const cleaned = emailSetupCode.replace(/\D/g, "");
    if (cleaned.length !== 6) return;
    setIsSettingUp(true);
    setSetupError(null);
    try {
      await securityService.enableOtp("email", cleaned);
      toast.success("Email verification enabled!");
      setEnabledMethods(["email_otp"]);
      onMethodChange?.("email_otp");
      onSubmit(cleaned, "email_otp");
    } catch (error) {
      setSetupError(
        error instanceof Error
          ? error.message
          : "Invalid code. Please check your email and try again.",
      );
    } finally {
      setIsSettingUp(false);
    }
  };

  const copySecretKey = () => {
    if (!totpSetup?.secret) return;
    navigator.clipboard
      .writeText(totpSetup.secret)
      .then(() => {
        setTotpCopied(true);
        toast.success("Setup key copied");
        setTimeout(() => setTotpCopied(false), 2000);
      })
      .catch(() => {
        toast.error("Failed to copy setup key");
      });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-[420px] max-h-[90vh] overflow-y-auto rounded-[32px] border-none bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 p-0 outline-none dark:bg-none dark:bg-black2 [&>button]:hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>
            {requiresSecuritySetup ? "Set up security verification" : title}
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-95 text-primary-50 dark:bg-primary-70/15 dark:text-primary-80">
            <ShieldCheck className="h-5 w-5" />
          </div>

          <h2 className="text-lg font-semibold text-cryptoNight dark:text-white">
            {requiresSecuritySetup ? "Set up verification" : title}
          </h2>
          <p className="mx-auto mt-2 max-w-[320px] text-sm text-gray-20 dark:text-gray-40">
            {requiresSecuritySetup
              ? setupChannel === "totp"
                ? "Scan the QR code or enter the key to link your authenticator app."
                : "Verify your email address to secure your account and complete transfers."
              : description ||
                (activeMethod === "totp"
                  ? "Enter the 6-digit code from your authenticator app to authorize this transaction."
                  : activeMethod === "sms_otp"
                    ? "Enter the verification code sent to your phone to authorize this transaction."
                    : "Enter the verification code sent to your email to authorize this transaction.")}
          </p>

          {requiresSecuritySetup ? (
            <div className="mt-5 rounded-2xl border border-primary-90/30 bg-primary-99/70 p-4 text-left dark:border-primary-70/30 dark:bg-primary-70/10">
              {/* Channel Selector */}
              <div className="flex rounded-xl bg-gray-90 p-1 dark:bg-secondary-60">
                <button
                  type="button"
                  onClick={() => {
                    setSetupChannel("totp");
                    setSetupError(null);
                  }}
                  disabled={isSettingUp}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition cursor-pointer disabled:opacity-50",
                    setupChannel === "totp"
                      ? "bg-white text-primary-50 shadow-sm dark:bg-secondary-50 dark:text-primary-80 font-semibold"
                      : "text-gray-30 hover:text-cryptoNight dark:text-gray-40 dark:hover:text-white"
                  )}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>Authenticator</span>
                  <span className="rounded-full bg-primary-50/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary-50 dark:bg-primary-70/20 dark:text-primary-80">
                    Recommended
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSetupChannel("email");
                    setSetupError(null);
                  }}
                  disabled={isSettingUp}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition cursor-pointer disabled:opacity-50",
                    setupChannel === "email"
                      ? "bg-white text-primary-50 shadow-sm dark:bg-secondary-50 dark:text-primary-80 font-semibold"
                      : "text-gray-30 hover:text-cryptoNight dark:text-gray-40 dark:hover:text-white"
                  )}
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>Email</span>
                </button>
              </div>

              {setupChannel === "totp" ? (
                <div className="mt-4">
                  {isGeneratingTotp ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary-50 dark:text-primary-80" />
                      <p className="mt-2 text-xs text-gray-30 dark:text-gray-40">
                        Generating Authenticator setup...
                      </p>
                    </div>
                  ) : totpSetup ? (
                    <div className="space-y-3">
                      {totpSetup.qrCodeUrl ? (
                        <div className="flex justify-center rounded-2xl bg-white p-3 shadow-xs">
                          <Image
                            src={totpSetup.qrCodeUrl}
                            alt="Authenticator QR code"
                            width={140}
                            height={140}
                            unoptimized
                            className="rounded-lg"
                          />
                        </div>
                      ) : null}

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-medium text-gray-30 dark:text-gray-40">
                          <span>Setup key</span>
                          <button
                            type="button"
                            onClick={copySecretKey}
                            className="flex items-center gap-1 text-primary-50 hover:underline dark:text-primary-80 cursor-pointer"
                          >
                            {totpCopied ? (
                              <>
                                <Check className="h-3 w-3 text-green-500" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy key</span>
                              </>
                            )}
                          </button>
                        </div>
                        <div className="rounded-xl border border-black/5 bg-white px-3 py-2 font-mono text-xs text-cryptoNight select-all dark:border-white/10 dark:bg-secondary-60 dark:text-white break-all">
                          {totpSetup.secret}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-gray-30 dark:text-gray-40">
                          Enter 6-digit code from authenticator
                        </label>
                        <Input
                          value={totpCode}
                          onChange={(e) => {
                            setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                            setSetupError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && totpCode.length === 6 && !isSettingUp) {
                              e.preventDefault();
                              void completeTotpSetup();
                            }
                          }}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          placeholder="000000"
                          className={cn(
                            "h-11 rounded-xl bg-white text-center text-base font-semibold tracking-[0.3em] text-cryptoNight placeholder:tracking-normal placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 dark:bg-secondary-60 dark:text-white transition-all",
                            setupError
                              ? "border-red-500/80 focus-visible:ring-red-500/30 text-red-600 dark:border-red-500/80 dark:text-red-400"
                              : "border-black/5 focus-visible:ring-primary-70/20 dark:border-white/10"
                          )}
                          disabled={isSettingUp}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 text-center">
                      <p className="text-xs text-red-500">
                        {setupError || "Unable to start Authenticator setup."}
                      </p>
                      <button
                        type="button"
                        onClick={loadTotpSetup}
                        className="mt-2 text-xs font-semibold text-primary-50 hover:underline dark:text-primary-80 cursor-pointer"
                      >
                        Try again
                      </button>
                    </div>
                  )}

                  {setupError && totpSetup ? (
                    <div
                      role="alert"
                      aria-live="polite"
                      className="mt-2.5 flex items-center justify-center gap-1.5 text-xs font-medium text-red-500 dark:text-red-400"
                    >
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                      <span>{setupError}</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <p className="text-xs leading-5 text-gray-20 dark:text-gray-40">
                    We will send a 6-digit verification code to your registered email to verify and complete this transfer.
                  </p>

                  {emailSetupSent ? (
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-gray-30 dark:text-gray-40">
                        Enter 6-digit email code
                      </label>
                      <Input
                        value={emailSetupCode}
                        onChange={(e) => {
                          setEmailSetupCode(
                            e.target.value.replace(/\D/g, "").slice(0, 6)
                          );
                          setSetupError(null);
                        }}
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            emailSetupCode.length === 6 &&
                            !isSettingUp
                          ) {
                            e.preventDefault();
                            void completeEmailSetup();
                          }
                        }}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        placeholder="000000"
                        className={cn(
                          "h-11 rounded-xl bg-white text-center text-base font-semibold tracking-[0.3em] text-cryptoNight placeholder:tracking-normal placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 dark:bg-secondary-60 dark:text-white transition-all",
                          setupError
                            ? "border-red-500/80 focus-visible:ring-red-500/30 text-red-600 dark:border-red-500/80 dark:text-red-400"
                            : "border-black/5 focus-visible:ring-primary-70/20 dark:border-white/10"
                        )}
                        disabled={isSettingUp}
                      />
                      <div className="mt-2 text-center">
                        <button
                          type="button"
                          onClick={sendEmailSetupCode}
                          disabled={isSettingUp}
                          className="text-xs font-semibold text-primary-50 hover:underline dark:text-primary-80 cursor-pointer disabled:opacity-50"
                        >
                          {isSettingUp ? "Sending..." : "Resend code"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {setupError ? (
                    <div
                      role="alert"
                      aria-live="polite"
                      className="mt-2.5 flex items-center justify-center gap-1.5 text-xs font-medium text-red-500 dark:text-red-400"
                    >
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                      <span>{setupError}</span>
                    </div>
                  ) : null}
                </div>
              )}
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

          {!requiresSecuritySetup && isOtpMethod && onResend ? (
            <button
              type="button"
              onClick={() => onResend()}
              disabled={isSubmitting || isResending}
              className="mt-3 cursor-pointer text-xs font-semibold text-primary-50 transition hover:text-primary-30 disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-80 dark:hover:text-primary-90"
            >
              {isResending ? "Sending code..." : `Resend code`}
            </button>
          ) : null}

          {!requiresSecuritySetup ? (
            <div className="w-full">
              <Input
                value={trimmedCode}
                onChange={(event) => {
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                  if (errorMessage) {
                    onClearError?.();
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && canSubmit) {
                    event.preventDefault();
                    onSubmit(trimmedCode);
                  }
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="Enter 6-digit code"
                autoFocus
                className={cn(
                  "mt-5 h-12 rounded-2xl bg-gray-95 text-center text-base font-semibold tracking-[0.35em] text-cryptoNight placeholder:tracking-normal placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 dark:bg-secondary-60 dark:text-white transition-all",
                  errorMessage
                    ? "border-red-500/80 focus-visible:ring-red-500/30 text-red-600 dark:border-red-500/80 dark:text-red-400 dark:focus-visible:ring-red-500/30"
                    : "border-black/5 focus-visible:ring-primary-70/20 dark:border-white/10"
                )}
                disabled={isSubmitting}
              />
              {errorMessage ? (
                <div
                  role="alert"
                  aria-live="polite"
                  className="mt-2.5 flex items-center justify-center gap-1.5 text-xs font-medium text-red-500 dark:text-red-400"
                >
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isSettingUp}
              className="h-11 rounded-xl border border-gray-80 bg-white text-sm font-semibold text-gray-20 transition hover:bg-gray-95 disabled:opacity-50 dark:border-white/10 dark:bg-secondary-50 dark:text-gray-40 dark:hover:bg-secondary-60 cursor-pointer"
            >
              Cancel
            </button>
            {requiresSecuritySetup ? (
              setupChannel === "totp" ? (
                <button
                  type="button"
                  onClick={totpSetup ? completeTotpSetup : loadTotpSetup}
                  disabled={
                    isSettingUp ||
                    isGeneratingTotp ||
                    (Boolean(totpSetup) && totpCode.length !== 6)
                  }
                  className="h-11 rounded-xl bg-primary-50 text-sm font-semibold text-white transition hover:bg-primary-40 disabled:opacity-60 dark:bg-primary-70 dark:hover:bg-primary-80 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSettingUp ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : isGeneratingTotp ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : totpSetup ? (
                    "Verify & Complete"
                  ) : (
                    "Retry Setup"
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={
                    emailSetupSent ? completeEmailSetup : sendEmailSetupCode
                  }
                  disabled={
                    isSettingUp ||
                    (emailSetupSent && emailSetupCode.length !== 6)
                  }
                  className="h-11 rounded-xl bg-primary-50 text-sm font-semibold text-white transition hover:bg-primary-40 disabled:opacity-60 dark:bg-primary-70 dark:hover:bg-primary-80 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSettingUp ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Please wait...</span>
                    </>
                  ) : emailSetupSent ? (
                    "Verify & Complete"
                  ) : (
                    "Send Code"
                  )}
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => onSubmit(trimmedCode)}
                disabled={!canSubmit}
                className="h-11 rounded-xl bg-primary-50 text-sm font-semibold text-white transition hover:bg-primary-40 disabled:opacity-60 dark:bg-primary-70 dark:hover:bg-primary-80 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Confirming...</span>
                  </>
                ) : (
                  "Confirm"
                )}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
