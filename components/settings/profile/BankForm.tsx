"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Landmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SelectableBank } from "@/components/modals/SelectBankModal";
import { providerService } from "@/services/api/payment-providers";
import type { BankDetail } from "@/types/db";
import { BankAccountDetailsCard } from "@/components/wallet/shared/BankAccountCards";

export type BankFormValues = {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  bankCode: string;
  provider: string;
  country: string;
};

interface BankFormProps {
  initialData?: BankDetail | null;
  selectedProviderBank: SelectableBank | null;
  onOpenBankModal: () => void;
  onSubmit: (data: BankFormValues) => void;
  isSubmitting: boolean;
}

const DEFAULT_COUNTRY = "NG";
const DEFAULT_PROVIDER = "centiiv";

const BankForm = ({
  initialData,
  selectedProviderBank,
  onOpenBankModal,
  onSubmit,
  isSubmitting,
}: BankFormProps) => {
  const [accountNumber, setAccountNumber] = useState(
    initialData?.accountNumber || "",
  );
  const [verifiedAccount, setVerifiedAccount] = useState<BankFormValues | null>(
    initialData
      ? {
          bankName: initialData.bankName,
          accountHolderName: initialData.accountName,
          accountNumber: initialData.accountNumber,
          bankCode: initialData.bankCode || "",
          provider: initialData.provider || DEFAULT_PROVIDER,
          country: initialData.country || DEFAULT_COUNTRY,
        }
      : null,
  );
  const [verificationError, setVerificationError] = useState("");
  const [bankError, setBankError] = useState("");
  const [accountNumberError, setAccountNumberError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const lastVerificationKeyRef = useRef("");
  const selectedProviderBankValue = selectedProviderBank?.value;

  const activeBank = useMemo<SelectableBank | null>(() => {
    if (selectedProviderBank) return selectedProviderBank;
    if (!initialData?.bankName || !initialData?.bankCode) return null;

    return {
      label: initialData.bankName,
      value: initialData.bankCode,
    };
  }, [initialData, selectedProviderBank]);

  useEffect(() => {
    if (!selectedProviderBankValue) return;

    setAccountNumber("");
    setVerifiedAccount(null);
    setVerificationError("");
    setBankError("");
    setAccountNumberError("");
    lastVerificationKeyRef.current = "";
  }, [selectedProviderBankValue]);

  useEffect(() => {
    const hasValidAccountNumber = /^\d{10}$/.test(accountNumber);

    if (!activeBank || !hasValidAccountNumber) {
      if (!initialData || accountNumber !== initialData.accountNumber) {
        setVerifiedAccount(null);
      }
      setVerificationError("");
      lastVerificationKeyRef.current = "";
      return;
    }

    const verificationKey = `${activeBank.value}:${accountNumber}`;
    if (lastVerificationKeyRef.current === verificationKey) return;

    let cancelled = false;

    const verifyBank = async () => {
      lastVerificationKeyRef.current = verificationKey;
      setIsVerifying(true);
      setVerifiedAccount(null);
      setVerificationError("");

      try {
        const response = await providerService.verifyBank({
          bankCode: activeBank.value,
          accountNumber,
          save: false,
          bankName: activeBank.label,
        });

        if (cancelled) return;

        const accountName = response.data.accountName;
        if (!accountName) {
          setVerificationError(
            "Account verified, but the provider did not return an account name.",
          );
          return;
        }

        setVerifiedAccount({
          bankName: response.data.bankName || activeBank.label,
          accountHolderName: accountName,
          accountNumber: response.data.accountNumber || accountNumber,
          bankCode: response.data.bankCode || activeBank.value,
          provider: DEFAULT_PROVIDER,
          country: DEFAULT_COUNTRY,
        });
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "Bank verification failed";
          setVerificationError(message);
          toast.error(message);
        }
      } finally {
        if (!cancelled) setIsVerifying(false);
      }
    };

    verifyBank();

    return () => {
      cancelled = true;
    };
  }, [accountNumber, activeBank, initialData]);

  const handleAccountNumberChange = (value: string) => {
    if (!/^\d{0,10}$/.test(value)) return;

    setAccountNumber(value);
    setAccountNumberError(
      value.length === 0 || value.length === 10
        ? ""
        : "Account number must be exactly 10 digits.",
    );

    if (value.length !== 10) {
      setVerifiedAccount(null);
      setVerificationError("");
    }
  };

  const handleSubmit = () => {
    if (!activeBank) {
      setBankError("Select a bank to continue.");
      return;
    }

    if (!/^\d{10}$/.test(accountNumber)) {
      setAccountNumberError("Enter a valid 10-digit account number.");
      return;
    }

    if (!verifiedAccount) {
      setVerificationError(
        isVerifying
          ? "Wait while we verify this account."
          : "Verify this bank account before saving.",
      );
      return;
    }

    onSubmit(verifiedAccount);
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onOpenBankModal}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between rounded-2xl border px-4 py-4 text-left transition",
          activeBank
            ? "border-primary-80 bg-primary-95/70 dark:border-primary-70/20 dark:bg-primary-70/10"
            : bankError
              ? "border-red-400 bg-red-50 text-red-500 dark:border-red-500/40 dark:bg-red-500/10"
              : "border-dashed border-primary-60/60 bg-primary-70/5 text-primary-60 hover:bg-primary-70/10",
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-95 text-primary-60 dark:bg-primary-70/10 dark:text-primary-80">
            {activeBank?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeBank.image}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <Landmark className="h-4 w-4" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-cryptoNight dark:text-white">
              {activeBank?.label || "Select bank"}
            </span>
          </span>
        </span>
        {activeBank ? (
          <span className="text-xs font-semibold text-primary-60">Change</span>
        ) : null}
      </button>
      {bankError ? (
        <p className="-mt-2 text-xs font-medium text-red-500">{bankError}</p>
      ) : null}

      {activeBank ? (
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-mid text-gray-30 dark:text-gray-40">
            Account Number
          </label>
          <div className="relative">
            <Input
              value={accountNumber}
              onChange={(event) =>
                handleAccountNumberChange(event.target.value)
              }
              inputMode="numeric"
              maxLength={10}
              placeholder="Enter 10-digit account number"
              aria-invalid={Boolean(accountNumberError || verificationError)}
              className={cn(
                "h-12 rounded-2xl border-black/5 bg-gray-95 text-sm text-cryptoNight placeholder:text-gray-400 focus-visible:ring-primary-70/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white dark:placeholder:text-gray-40",
                (accountNumberError || verificationError) &&
                  "border-red-400 focus-visible:ring-red-400/20 dark:border-red-500/50",
              )}
            />
            {isVerifying ? (
              <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary-60" />
            ) : null}
          </div>
          {accountNumberError ? (
            <p className="text-xs font-medium text-red-500">
              {accountNumberError}
            </p>
          ) : accountNumber.length > 0 && accountNumber.length < 10 ? (
            <p className="text-xs text-gray-30 dark:text-gray-40">
              Account number must be exactly 10 digits.
            </p>
          ) : null}
          {verificationError ? (
            <p className="text-xs font-medium text-red-500">
              {verificationError}
            </p>
          ) : null}
        </div>
      ) : null}

      {verifiedAccount ? (
        <BankAccountDetailsCard
          title="Bank account verified"
          account={{
            bankName: verifiedAccount.bankName,
            accountNumber: verifiedAccount.accountNumber,
            accountName: verifiedAccount.accountHolderName,
          }}
        />
      ) : null}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting || isVerifying}
        className="group relative w-full cursor-pointer overflow-hidden rounded-xl bg-gradient-to-r from-primary-70 to-primary-60 py-3 font-bold text-white shadow-lg transition-all hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
      >
        <span className="relative z-10 flex items-center justify-center gap-2 text-sm md:text-base">
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Saving...
            </>
          ) : initialData ? (
            "Update Bank Account"
          ) : (
            "Save Bank Account"
          )}
        </span>
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
      </button>
    </div>
  );
};

export default BankForm;
