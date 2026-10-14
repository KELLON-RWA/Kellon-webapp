"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ALL_SUPPORTED_COUNTRIES } from "@/lib/supported-countries";
import { useKyc } from "@/hooks/use-kyc";
import type {
  KycDocumentRule,
  KycField,
  KycProfileInput,
} from "@/services/api/kyc";

const FIELD_LABELS: Record<KycField, string> = {
  country: "country",
  fullName: "full legal name",
  dateOfBirth: "date of birth",
  document: "ID document",
  phone: "phone number",
};

const fieldClass =
  "h-12 rounded-2xl border-black/5 bg-gray-95 text-black placeholder:text-gray-400 focus-visible:ring-primary-70/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white";

const issuerFor = (rule: KycDocumentRule, country: string) =>
  rule.issuerCountries[0] ?? country;

interface KycDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The country of the payment that needs these details, when known. */
  country?: string;
  reason?: string;
  onSaved?: () => void;
}

export function KycDialog({
  open,
  onOpenChange,
  country: requiredCountry,
  reason,
  onSaved,
}: KycDialogProps) {
  const { profile, requirements, isLoading, isSaving, save, loadRequirements } =
    useKyc(requiredCountry || undefined, open);
  const [country, setCountry] = useState(requiredCountry || "");
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [documentType, setDocumentType] = useState<
    KycDocumentRule["type"] | null
  >(null);
  const [documentNumber, setDocumentNumber] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName ?? "");
    setDateOfBirth(profile.dateOfBirth ?? "");
    setPhone(profile.phoneE164 ?? "");
    setCountry((current) => current || profile.country || "NG");
  }, [profile]);

  useEffect(() => {
    if (requiredCountry) setCountry(requiredCountry);
  }, [requiredCountry]);

  useEffect(() => {
    if (open && country) loadRequirements(country).catch(() => {});
  }, [open, country, loadRequirements]);

  const rules = requirements?.documents ?? [];
  const selectedRule =
    rules.find((rule) => rule.type === documentType) ?? rules[0];
  const savedDocument = selectedRule
    ? profile?.documents.find(
        (doc) =>
          doc.type === selectedRule.type &&
          doc.issuerCountry === issuerFor(selectedRule, country),
      )
    : undefined;
  const phoneRequired = requirements?.phone.required ?? false;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRule) return;
    const number = documentNumber.replace(/\s+/g, "").toUpperCase();
    if (!savedDocument && !number) {
      toast.error(`Enter your ${selectedRule.label} number.`);
      return;
    }
    if (number && !new RegExp(selectedRule.pattern).test(number)) {
      toast.error(
        `Enter a valid ${selectedRule.label} (${selectedRule.hint}).`,
      );
      return;
    }
    const cleanPhone = phone.replace(/[\s()-]/g, "");
    if (
      phoneRequired &&
      requirements &&
      !new RegExp(requirements.phone.pattern).test(cleanPhone)
    ) {
      toast.error(requirements.phone.hint);
      return;
    }

    const input: KycProfileInput = {
      fullName,
      country,
      ...(dateOfBirth ? { dateOfBirth } : {}),
    };
    if (cleanPhone || profile?.phoneE164) input.phoneE164 = cleanPhone || null;
    if (number) {
      input.document = {
        type: selectedRule.type,
        issuerCountry: issuerFor(selectedRule, country),
        number,
      };
    }

    try {
      const missing = await save(input);
      if (missing.length) {
        toast.error(
          `Still needed: ${missing.map((field) => FIELD_LABELS[field]).join(", ")}.`,
        );
        return;
      }
      setDocumentNumber("");
      toast.success("Identity details saved");
      onSaved?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save your identity details.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-[32px] border-none bg-gray-70 sm:max-w-md dark:bg-black2">
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-70/10 text-primary-70">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <DialogTitle>Identity details</DialogTitle>
          <DialogDescription>
            {reason ||
              "Some payment partners need to know who is paying. Use the details on your ID; they must match the name on your bank account."}
          </DialogDescription>
        </DialogHeader>

        {isLoading && !profile ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary-70" />
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Country
              </span>
              <select
                value={country}
                onChange={(event) => {
                  setCountry(event.target.value);
                  setDocumentType(null);
                  setDocumentNumber("");
                }}
                className={cn(fieldClass, "w-full border px-3 text-sm")}
              >
                {ALL_SUPPORTED_COUNTRIES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Full legal name
              </span>
              <Input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="As it appears on your ID"
                autoComplete="name"
                className={fieldClass}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Date of birth
              </span>
              <Input
                type="date"
                value={dateOfBirth}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setDateOfBirth(event.target.value)}
                autoComplete="bday"
                className={fieldClass}
              />
            </label>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                ID document
              </span>
              <div className="flex flex-wrap gap-2">
                {rules.map((rule) => {
                  const active = rule.type === selectedRule?.type;
                  return (
                    <button
                      key={rule.type}
                      type="button"
                      onClick={() => {
                        setDocumentType(rule.type);
                        setDocumentNumber("");
                      }}
                      className={cn(
                        "cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors",
                        active
                          ? "border-primary-60 bg-primary-70/10 text-primary-70"
                          : "border-black/10 dark:border-white/10",
                      )}
                    >
                      {rule.label}
                    </button>
                  );
                })}
              </div>
              {selectedRule ? (
                <Input
                  value={documentNumber}
                  onChange={(event) => setDocumentNumber(event.target.value)}
                  placeholder={
                    savedDocument
                      ? `Saved ending ${savedDocument.last4}. Enter to replace`
                      : selectedRule.hint
                  }
                  inputMode={
                    /^\^\\d/.test(selectedRule.pattern) ? "numeric" : "text"
                  }
                  autoComplete="off"
                  className={fieldClass}
                />
              ) : null}
            </div>

            {phoneRequired || profile?.phoneE164 ? (
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Phone number{phoneRequired ? "" : " (optional)"}
                </span>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder={requirements?.phone.hint}
                  autoComplete="tel"
                  className={fieldClass}
                />
              </label>
            ) : null}

            <button
              type="submit"
              disabled={isSaving || !selectedRule}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-70 to-primary-60 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              Save details
            </button>
            <p className="text-center text-xs text-gray-500">
              Your ID number is encrypted and only shared with the payment
              partner processing your transaction.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
