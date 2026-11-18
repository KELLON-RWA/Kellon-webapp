"use client";

import { useEffect, useMemo } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ALL_SUPPORTED_COUNTRIES } from "@/lib/supported-countries";
import { useKyc } from "@/hooks/use-kyc";
import type {
  KycDocumentRule,
  KycDocumentType,
  KycField,
  KycProfileInput,
  KycRequirements,
} from "@/services/api/kyc";

const FIELD_LABELS: Record<KycField, string> = {
  country: "country",
  fullName: "full legal name",
  dateOfBirth: "date of birth",
  document: "ID document",
  phone: "phone number",
};

const fieldClass =
  "h-12 rounded-2xl border border-black/5 bg-gray-95 text-black placeholder:text-gray-400 focus-visible:ring-primary-70/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white [color-scheme:light] dark:[color-scheme:dark] aria-invalid:border-destructive dark:aria-invalid:border-destructive";

const issuerFor = (rule: KycDocumentRule, country: string) =>
  rule.issuerCountries[0] ?? country;

export interface KycFormValues {
  country: string;
  fullName: string;
  dateOfBirth: string;
  documentType: string;
  documentNumber: string;
  phone: string;
}

export function createKycSchema(params: {
  selectedRule?: KycDocumentRule;
  savedDocument?: { type: KycDocumentType; issuerCountry: string; last4: string };
  requirements?: KycRequirements | null;
  phoneRequired: boolean;
}) {
  const { selectedRule, savedDocument, requirements, phoneRequired } = params;
  const minAge = requirements?.minimumAge ?? 18;

  return z
    .object({
      country: z.string().min(1, "Please select a country"),
      fullName: z
        .string()
        .trim()
        .min(1, "Full legal name is required")
        .min(2, "Name must be at least 2 characters")
        .max(100, "Name must not exceed 100 characters")
        .refine(
          (val) => !/[0-9]/.test(val),
          "Full legal name should not contain numbers",
        )
        .refine(
          (val) => val.trim().split(/\s+/).filter(Boolean).length >= 2,
          "Please enter your full legal name (first and last name)",
        ),
      dateOfBirth: z
        .string()
        .min(1, "Date of birth is required")
        .refine(
          (val) => !isNaN(Date.parse(val)),
          "Please enter a valid date of birth",
        )
        .refine((val) => {
          const date = new Date(val);
          const today = new Date();
          return date <= today;
        }, "Date of birth cannot be in the future")
        .refine((val) => {
          const birthDate = new Date(val);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          return age >= minAge;
        }, `You must be at least ${minAge} years old`)
        .refine((val) => {
          const birthDate = new Date(val);
          const today = new Date();
          const age = today.getFullYear() - birthDate.getFullYear();
          return age <= 120;
        }, "Please enter a valid date of birth"),
      documentType: z.string(),
      documentNumber: z.string(),
      phone: z.string(),
    })
    .superRefine((data, ctx) => {
      // Document Number Validation
      if (selectedRule) {
        const rawNum = data.documentNumber
          ? data.documentNumber.replace(/\s+/g, "").toUpperCase()
          : "";

        if (!savedDocument && !rawNum) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Enter your ${selectedRule.label} number`,
            path: ["documentNumber"],
          });
        } else if (rawNum && selectedRule.pattern) {
          const regex = new RegExp(selectedRule.pattern);
          if (!regex.test(rawNum)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Enter a valid ${selectedRule.label} (${selectedRule.hint})`,
              path: ["documentNumber"],
            });
          }
        }
      }

      // Phone Number Validation
      const cleanPhone = data.phone
        ? data.phone.replace(/[\s()-]/g, "")
        : "";

      if (phoneRequired && !cleanPhone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: requirements?.phone?.hint || "Phone number is required",
          path: ["phone"],
        });
      } else if (cleanPhone && requirements?.phone?.pattern) {
        const regex = new RegExp(requirements.phone.pattern);
        if (!regex.test(cleanPhone)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              requirements.phone.hint || "Please enter a valid phone number",
            path: ["phone"],
          });
        }
      }
    });
}

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

  const rules = requirements?.documents ?? [];
  const phoneRequired = requirements?.phone?.required ?? false;

  const defaultCountry = requiredCountry || profile?.country || "NG";

  const form = useForm<KycFormValues>({
    resolver: (values, context, options) => {
      // Dynamic validation schema based on selected rule & requirements
      const activeRule =
        rules.find((r) => r.type === values.documentType) ?? rules[0];
      const activeSavedDoc = activeRule
        ? profile?.documents.find(
            (doc) =>
              doc.type === activeRule.type &&
              doc.issuerCountry === issuerFor(activeRule, values.country),
          )
        : undefined;

      const dynamicSchema = createKycSchema({
        selectedRule: activeRule,
        savedDocument: activeSavedDoc,
        requirements,
        phoneRequired,
      });

      const resolver = zodResolver(dynamicSchema);
      return resolver(values, context, options);
    },
    defaultValues: {
      country: defaultCountry,
      fullName: "",
      dateOfBirth: "",
      documentType: "",
      documentNumber: "",
      phone: "",
    },
    mode: "onTouched",
  });

  const watchedCountry = form.watch("country");
  const watchedDocumentType = form.watch("documentType");

  const selectedRule =
    rules.find((rule) => rule.type === watchedDocumentType) ?? rules[0];

  const savedDocument = selectedRule
    ? profile?.documents.find(
        (doc) =>
          doc.type === selectedRule.type &&
          doc.issuerCountry === issuerFor(selectedRule, watchedCountry),
      )
    : undefined;

  // Sync profile when it loads or dialog opens
  useEffect(() => {
    if (!profile) return;
    const initialCountry =
      requiredCountry || profile.country || form.getValues("country") || "NG";
    form.reset({
      country: initialCountry,
      fullName: profile.fullName ?? "",
      dateOfBirth: profile.dateOfBirth
        ? profile.dateOfBirth.slice(0, 10)
        : "",
      documentType:
        form.getValues("documentType") || rules[0]?.type || "",
      documentNumber: "",
      phone: profile.phoneE164 ?? "",
    });
  }, [profile, requiredCountry]);

  // Sync country if requiredCountry changes
  useEffect(() => {
    if (requiredCountry) {
      form.setValue("country", requiredCountry);
    }
  }, [requiredCountry, form]);

  // Load requirements when dialog is open and country changes
  useEffect(() => {
    if (open && watchedCountry) {
      loadRequirements(watchedCountry).catch(() => {});
    }
  }, [open, watchedCountry, loadRequirements]);

  // Default to first document rule when requirements load
  useEffect(() => {
    if (rules.length > 0) {
      const current = form.getValues("documentType");
      if (!current || !rules.some((r) => r.type === current)) {
        form.setValue("documentType", rules[0].type);
      }
    }
  }, [rules, form]);

  const handleCountryChange = (newCountry: string) => {
    form.setValue("country", newCountry);
    form.setValue("documentType", "");
    form.setValue("documentNumber", "");
    form.clearErrors("documentNumber");
    loadRequirements(newCountry).catch(() => {});
  };

  const isNumericDoc = useMemo(() => {
    if (!selectedRule?.pattern) return false;
    return /^\^?(\\d|\[0-9\])/.test(selectedRule.pattern);
  }, [selectedRule]);

  const onSubmit = async (values: KycFormValues) => {
    if (!selectedRule) return;

    const number = values.documentNumber.replace(/\s+/g, "").toUpperCase();
    const cleanPhone = values.phone.replace(/[\s()-]/g, "");

    const input: KycProfileInput = {
      fullName: values.fullName.trim(),
      country: values.country,
      ...(values.dateOfBirth ? { dateOfBirth: values.dateOfBirth } : {}),
    };

    if (cleanPhone || profile?.phoneE164) {
      input.phoneE164 = cleanPhone || null;
    }

    if (number) {
      input.document = {
        type: selectedRule.type,
        issuerCountry: issuerFor(selectedRule, values.country),
        number,
      };
    }

    try {
      const missing = await save(input);
      if (missing.length) {
        for (const field of missing) {
          if (field === "fullName") {
            form.setError("fullName", {
              message: "Full legal name is required",
            });
          } else if (field === "dateOfBirth") {
            form.setError("dateOfBirth", {
              message: "Date of birth is required",
            });
          } else if (field === "document") {
            form.setError("documentNumber", {
              message: "Valid ID document required",
            });
          } else if (field === "phone") {
            form.setError("phone", {
              message: "Phone number required",
            });
          }
        }
        toast.error(
          `Still needed: ${missing.map((field) => FIELD_LABELS[field]).join(", ")}.`,
        );
        return;
      }

      form.setValue("documentNumber", "");
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
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
              noValidate
            >
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-1.5">
                    <FormLabel className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Country
                    </FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          handleCountryChange(event.target.value);
                        }}
                        className={cn(
                          fieldClass,
                          "w-full border px-3 text-sm cursor-pointer",
                        )}
                      >
                        {ALL_SUPPORTED_COUNTRIES.map((item) => (
                          <option
                            key={item.code}
                            value={item.code}
                            className="bg-white text-black dark:bg-secondary-60 dark:text-white"
                          >
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-1.5">
                    <FormLabel className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Full legal name
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="As it appears on your ID"
                        autoComplete="name"
                        className={fieldClass}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-1.5">
                    <FormLabel className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Date of birth
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        max={new Date().toISOString().slice(0, 10)}
                        autoComplete="bday"
                        className={fieldClass}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="documentNumber"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-1.5">
                    <FormLabel className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      ID document
                    </FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {rules.map((rule) => {
                        const active = rule.type === selectedRule?.type;
                        return (
                          <button
                            key={rule.type}
                            type="button"
                            onClick={() => {
                              form.setValue("documentType", rule.type);
                              form.setValue("documentNumber", "");
                              form.clearErrors("documentNumber");
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
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={
                            savedDocument
                              ? `Saved ending ${savedDocument.last4}. Enter to replace`
                              : selectedRule.hint
                          }
                          inputMode={isNumericDoc ? "numeric" : "text"}
                          autoComplete="off"
                          className={fieldClass}
                        />
                      </FormControl>
                    ) : null}
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              {phoneRequired || profile?.phoneE164 ? (
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-1.5">
                      <FormLabel className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Phone number{phoneRequired ? "" : " (optional)"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          {...field}
                          placeholder={requirements?.phone?.hint}
                          autoComplete="tel"
                          className={fieldClass}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              ) : null}

              <button
                type="submit"
                disabled={isSaving || !selectedRule}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary-70 to-primary-60 py-3 font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : null}
                Save details
              </button>
              <p className="text-center text-xs text-gray-500">
                Your ID number is encrypted and only shared with the payment
                partner processing your transaction.
              </p>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
