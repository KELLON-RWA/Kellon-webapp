"use client";

import { useEffect, useState } from "react";
import { Mail, MessageSquareText, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface TransferVerificationModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  verificationType: "otp" | "totp";
  onClose: () => void;
  onSubmit: (code: string) => void;
  title?: string;
  actionNoun?: string;
  description?: string;
  onResend?: () => void;
  isResending?: boolean;
  otpChannels?: Array<"email" | "sms">;
  selectedOtpChannel?: "email" | "sms";
  onOtpChannelChange?: (channel: "email" | "sms") => void;
  otpSent?: boolean;
}

export default function TransferVerificationModal({
  isOpen,
  isSubmitting,
  verificationType,
  onClose,
  onSubmit,
  title = "Verify transfer",
  actionNoun = "send",
  description,
  onResend,
  isResending = false,
  otpChannels = [],
  selectedOtpChannel,
  onOtpChannelChange,
  otpSent = true,
}: TransferVerificationModalProps) {
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!isOpen) setCode("");
  }, [isOpen]);

  const trimmedCode = code.trim();
  const canSubmit =
    trimmedCode.length >= 4 &&
    !isSubmitting &&
    (verificationType !== "otp" || otpSent);
  const showOtpChannelPicker =
    verificationType === "otp" &&
    otpChannels.length > 0 &&
    selectedOtpChannel &&
    onOtpChannelChange;
  const isChoosingOtpChannel =
    verificationType === "otp" && !otpSent && Boolean(onResend);

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
              `Enter your ${verificationType.toUpperCase()} code to complete this ${actionNoun}.`}
          </p>

          {showOtpChannelPicker ? (
            <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-gray-90 p-1 dark:bg-secondary-60">
              {otpChannels.map((channel) => {
                const ChannelIcon =
                  channel === "email" ? Mail : MessageSquareText;
                const isSelected = selectedOtpChannel === channel;

                return (
                  <button
                    key={channel}
                    type="button"
                    onClick={() => onOtpChannelChange(channel)}
                    disabled={isSubmitting || isResending}
                    className={`flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg text-xs font-semibold capitalize transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      isSelected
                        ? "bg-white text-primary-50 shadow-sm dark:bg-secondary-50 dark:text-primary-80"
                        : "text-gray-30 hover:text-cryptoNight dark:text-gray-40 dark:hover:text-white"
                    }`}
                  >
                    <ChannelIcon className="h-4 w-4" />
                    {channel === "sms" ? "SMS" : "Email"}
                  </button>
                );
              })}
            </div>
          ) : null}

          {verificationType === "otp" && onResend && otpSent ? (
            <button
              type="button"
              onClick={onResend}
              disabled={isSubmitting || isResending}
              className="mt-3 cursor-pointer text-xs font-semibold text-primary-50 transition hover:text-primary-30 disabled:cursor-not-allowed disabled:opacity-50 dark:text-primary-80 dark:hover:text-primary-90"
            >
              {isResending
                ? "Sending code..."
                : `Resend by ${selectedOtpChannel === "sms" ? "SMS" : "email"}`}
            </button>
          ) : null}

          {verificationType === "totp" || otpSent ? (
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
                isChoosingOtpChannel
                  ? onResend
                  : () => onSubmit(trimmedCode)
              }
              disabled={
                isChoosingOtpChannel
                  ? isSubmitting || isResending || !selectedOtpChannel
                  : !canSubmit
              }
              className="h-11 rounded-xl bg-primary-50 text-sm font-semibold text-white transition hover:bg-primary-40 disabled:opacity-60 dark:bg-primary-70 dark:hover:bg-primary-80 cursor-pointer"
            >
              {isChoosingOtpChannel
                ? isResending
                  ? "Sending..."
                  : `Send ${selectedOtpChannel === "sms" ? "SMS" : "email"} code`
                : isSubmitting
                  ? "Verifying..."
                  : "Verify code"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
