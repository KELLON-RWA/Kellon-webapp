"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowLeft, ArrowRight, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import StepIndicator from "@/components/wallet/shared/FlowStepIndicator";
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter";
import { invoiceService } from "@/services/api/invoices";
import {
  transferService,
  type TransferRecipient,
} from "@/services/api/transfers";
import type { User } from "@/types/db";
import { AmountSection } from "./create-invoice/AmountSection";
import { CustomerDetailsSection } from "./create-invoice/CustomerDetailsSection";
import { DescriptionSection } from "./create-invoice/DescriptionSection";
import { ExpirySection } from "./create-invoice/ExpirySection";
import { InvoiceReview } from "./create-invoice/InvoiceReview";
import {
  EXPIRY_PRESETS,
  INVOICE_STEPS,
  invoiceSchema,
  type InvoiceFormValues,
  type InvoiceStep,
} from "./create-invoice/types";
import {
  getExpiryDate,
  getInvoiceAssetGroups,
  getInvoiceAssetOptions,
  getInvoiceCustomerContactLabel,
  isInvoiceCustomerContactEmail,
} from "./create-invoice/utils";

interface CreateInvoicePageProps {
  profile: User;
}

export default function CreateInvoicePage({ profile }: CreateInvoicePageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const assetOptions = useMemo(
    () => getInvoiceAssetOptions(profile.assets || []),
    [profile.assets],
  );
  const assetGroups = useMemo(
    () => getInvoiceAssetGroups(assetOptions),
    [assetOptions],
  );
  const defaultAsset = assetGroups[0];
  const queryAsset = searchParams.get("asset")?.toUpperCase() || "";
  const queryChain = searchParams.get("network") || searchParams.get("chain");
  const queryAmount = searchParams.get("amount") || "";
  const queryCustomer = searchParams.get("customer") || "";
  const queryCustomerName = searchParams.get("customerName") || "";
  const queryDescription = searchParams.get("description") || "";
  const queryExpiry = searchParams.get(
    "expiry",
  ) as InvoiceFormValues["expiryPreset"] | null;
  const queryStep = searchParams.get("step") as InvoiceStep | null;
  const queryAssetGroup = assetGroups.find(
    (asset) => asset.symbol === queryAsset,
  );
  const queryAssetChain = queryAssetGroup?.chains.find(
    (asset) => asset.chain.toLowerCase() === queryChain?.toLowerCase(),
  );

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      amount: queryAmount,
      assetSymbol: queryAssetGroup?.symbol || defaultAsset?.symbol || "",
      chain:
        queryAssetChain?.chain ||
        queryAssetGroup?.chains[0]?.chain ||
        defaultAsset?.chains[0]?.chain ||
        "",
      description: queryDescription,
      customerName: queryCustomerName,
      customerContact: queryCustomer,
      expiryPreset:
        queryExpiry &&
        EXPIRY_PRESETS.some((preset) => preset.value === queryExpiry)
          ? queryExpiry
          : "1d",
    },
  });

  const selectedAssetSymbol = form.watch("assetSymbol");
  const selectedChain = form.watch("chain");
  const watchedAmount = form.watch("amount");
  const watchedDescription = form.watch("description");
  const watchedCustomerName = form.watch("customerName");
  const watchedExpiryPreset = form.watch("expiryPreset");
  const customerContact = form.watch("customerContact");

  const selectedAssetGroup = assetGroups.find(
    (asset) => asset.symbol === selectedAssetSymbol,
  );
  const selectedAsset = selectedAssetGroup?.chains.find(
    (asset) => asset.chain === selectedChain,
  );
  const selectedExpiry = EXPIRY_PRESETS.find(
    (preset) => preset.value === watchedExpiryPreset,
  );
  const customerContactValue = customerContact.trim();
  const customerContactKey = customerContactValue.toLowerCase();
  const customerContactLabel =
    getInvoiceCustomerContactLabel(customerContactValue);

  const [verifiedCustomer, setVerifiedCustomer] =
    useState<TransferRecipient | null>(null);
  const [verifiedCustomerContact, setVerifiedCustomerContact] = useState("");
  const [isVerifyingCustomer, setIsVerifyingCustomer] = useState(false);
  const [customerLookupMessage, setCustomerLookupMessage] = useState("");
  const [mobileStep, setMobileStep] = useState<InvoiceStep>("amount");
  const [isDesktopReview, setIsDesktopReview] = useState(false);
  const isCurrentCustomerVerified =
    Boolean(verifiedCustomer?.found) &&
    verifiedCustomerContact === customerContactKey;

  const updateUrl = (
    updates: Record<string, string | null>,
    options: { replace?: boolean } = {},
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;

    Object.entries(updates).forEach(([key, value]) => {
      const currentValue = params.get(key);

      if (!value && currentValue !== null) {
        params.delete(key);
        changed = true;
        return;
      }

      if (value && currentValue !== value) {
        params.set(key, value);
        changed = true;
      }
    });

    if (!changed) return;

    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    const navigate = options.replace ? router.replace : router.push;
    navigate(nextUrl, { scroll: false });
  };

  const profileWithUsername = profile as User & {
    username?: string | null;
  };
  const selfIdentifierKey = useMemo(() => {
    const identifiers = [
      profile.id || "",
      profile.email || "",
      profile.tag || "",
      profile.tag ? `@${profile.tag.replace(/^@/, "")}` : "",
      profileWithUsername.username || "",
      profileWithUsername.username
        ? `@${profileWithUsername.username.replace(/^@/, "")}`
        : "",
    ];

    return identifiers
      .filter(Boolean)
      .map((identifier) => identifier.toLowerCase())
      .join("|");
  }, [profile.email, profile.id, profile.tag, profileWithUsername.username]);
  const selfIdentifiers = useMemo(
    () => new Set(selfIdentifierKey.split("|").filter(Boolean)),
    [selfIdentifierKey],
  );

  useEffect(() => {
    if (!selectedAssetGroup) {
      form.setValue("assetSymbol", defaultAsset?.symbol || "");
      form.setValue("chain", defaultAsset?.chains[0]?.chain || "");
      return;
    }

    const chainIsAvailable = selectedAssetGroup.chains.some(
      (asset) => asset.chain === selectedChain,
    );

    if (!chainIsAvailable) {
      form.setValue("chain", selectedAssetGroup.chains[0]?.chain || "");
    }
  }, [defaultAsset, form, selectedAssetGroup, selectedChain]);

  useEffect(() => {
    updateUrl(
      {
        asset: selectedAssetSymbol || null,
        network: selectedChain || null,
        amount: watchedAmount || null,
        customer: customerContactValue || null,
        customerName: watchedCustomerName || null,
        description: watchedDescription || null,
        expiry: watchedExpiryPreset || null,
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    customerContactValue,
    selectedAssetSymbol,
    selectedChain,
    watchedAmount,
    watchedCustomerName,
    watchedDescription,
    watchedExpiryPreset,
  ]);

  useEffect(() => {
    if (!queryStep || !INVOICE_STEPS.includes(queryStep)) return;

    if (queryStep === "amount") {
      setMobileStep("amount");
      setIsDesktopReview(false);
      return;
    }

    if (queryStep === "details") {
      setMobileStep("details");
      setIsDesktopReview(false);
      return;
    }

    if (
      queryStep === "review" &&
      customerContactValue &&
      !verifiedCustomer &&
      (isVerifyingCustomer || !customerLookupMessage)
    ) {
      return;
    }

    if (queryStep === "review" && !isCurrentCustomerVerified) {
      setMobileStep("details");
      setIsDesktopReview(false);
      updateUrl({ step: "details" }, { replace: true });
      return;
    }

    if (queryStep === "review") {
      setMobileStep("review");
      setIsDesktopReview(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    customerContactValue,
    customerLookupMessage,
    isCurrentCustomerVerified,
    isVerifyingCustomer,
    queryStep,
    verifiedCustomer,
  ]);

  useEffect(() => {
    const contact = customerContact.trim();
    const contactKey = contact.toLowerCase();

    if (verifiedCustomer?.found && verifiedCustomerContact === contactKey) {
      return;
    }

    setVerifiedCustomer(null);
    setVerifiedCustomerContact("");

    if (!contact) {
      setCustomerLookupMessage("");
      return;
    }

    const isValidContact =
      isInvoiceCustomerContactEmail(contact) ||
      /^@?[a-zA-Z0-9._-]{3,}$/.test(contact);

    if (!isValidContact) {
      setCustomerLookupMessage("Enter a valid email or Kellon tag.");
      return;
    }

    if (selfIdentifiers.has(contact.toLowerCase())) {
      const message = "You can't create an invoice for yourself.";
      setCustomerLookupMessage(message);
      form.setError("customerContact", { message });
      return;
    }

    setCustomerLookupMessage("Checking Kellon user...");
    setIsVerifyingCustomer(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const lookupValue = isInvoiceCustomerContactEmail(contact)
          ? contact.toLowerCase()
          : contact.replace(/^@/, "");
        const response = await transferService.verifyRecipient(lookupValue);
        const customer = response.data;

        if (!customer?.found) {
          const message = "No Kellon user found for this contact.";
          setCustomerLookupMessage(message);
          form.setError("customerContact", { message });
          return;
        }

        setVerifiedCustomer(customer);
        setVerifiedCustomerContact(contactKey);
        setCustomerLookupMessage(
          customer.name
            ? `Verified as ${customer.name}`
            : "Kellon customer verified",
        );
        form.clearErrors("customerContact");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to verify this Kellon user.";
        setCustomerLookupMessage(message);
        form.setError("customerContact", { message });
      } finally {
        setIsVerifyingCustomer(false);
      }
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
      setIsVerifyingCustomer(false);
    };
  }, [
    customerContact,
    form,
    selfIdentifiers,
    verifiedCustomer,
    verifiedCustomerContact,
  ]);

  const ensureCustomerIsVerified = () => {
    if (isCurrentCustomerVerified) return true;

    form.setError("customerContact", {
      message: isVerifyingCustomer
        ? "Wait while we verify this Kellon customer."
        : "Verify this Kellon customer before continuing.",
    });
    return false;
  };

  const goToMobileDetails = async () => {
    const isValid = await form.trigger(["assetSymbol", "chain", "amount"]);
    if (isValid) {
      setMobileStep("details");
      updateUrl({ step: "details" });
    }
  };

  const goToMobileReview = async () => {
    const isValid = await form.trigger([
      "customerName",
      "customerContact",
      "description",
      "expiryPreset",
    ]);

    if (isValid && ensureCustomerIsVerified()) {
      setMobileStep("review");
      updateUrl({ step: "review" });
    }
  };

  const goToDesktopReview = async () => {
    const isValid = await form.trigger();
    if (isValid && ensureCustomerIsVerified()) {
      setIsDesktopReview(true);
      updateUrl({ step: "review" });
    }
  };

  const submitInvoice = async (values: InvoiceFormValues) => {
    const selectedAsset = assetOptions.find(
      (asset) =>
        asset.symbol === values.assetSymbol && asset.chain === values.chain,
    );

    if (!selectedAsset) {
      toast.error("Select an asset to request");
      return;
    }

    const customerContact = values.customerContact?.trim();
    const isEmailContact = customerContact
      ? isInvoiceCustomerContactEmail(customerContact)
      : false;

    if (!isCurrentCustomerVerified) {
      form.setError("customerContact", {
        message: "Verify this Kellon customer before creating the invoice.",
      });
      return;
    }

    try {
      await invoiceService.createInvoice({
        amount: values.amount,
        symbol: selectedAsset.symbol,
        chain: selectedAsset.chain,
        assetType: selectedAsset.assetType,
        description: values.description || undefined,
        customerName: values.customerName || undefined,
        customerEmail: isEmailContact ? customerContact : undefined,
        metadata: customerContact
          ? {
              customerContact,
              customerContactType: isEmailContact ? "email" : "kellon_tag",
            }
          : undefined,
        expiresAt: getExpiryDate(values.expiryPreset).toISOString(),
      });

      toast.success("Invoice created");
      router.push("/invoices");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to create invoice",
      );
    }
  };

  const amountSection = (
    <AmountSection
      form={form}
      assetGroups={assetGroups}
      selectedAssetGroup={selectedAssetGroup}
      selectedAsset={selectedAsset}
    />
  );
  const customerSection = (
    <CustomerDetailsSection
      form={form}
      customerLookupMessage={customerLookupMessage}
      verifiedCustomer={verifiedCustomer}
      isVerifyingCustomer={isVerifyingCustomer}
    />
  );
  const descriptionSection = <DescriptionSection form={form} />;
  const expirySection = <ExpirySection form={form} />;
  const reviewSection = (
    <InvoiceReview
      selectedAsset={selectedAsset}
      selectedAssetSymbol={selectedAssetSymbol}
      watchedAmount={watchedAmount}
      watchedDescription={watchedDescription}
      watchedExpiryPreset={watchedExpiryPreset}
      selectedExpiry={selectedExpiry}
      verifiedCustomer={verifiedCustomer}
      customerContactValue={customerContactValue}
      customerContactLabel={customerContactLabel}
    />
  );
  const isBusy = form.formState.isSubmitting || isVerifyingCustomer;

  return (
    <section className="container mx-auto flex min-h-[90dvh] max-w-4xl flex-col px-4 pb-28 pt-4 md:px-6 md:pb-14 md:pt-20">
      <header className="relative mb-8 flex items-center justify-center">
        <button
          type="button"
          onClick={() => {
            if (isDesktopReview) {
              setIsDesktopReview(false);
              setMobileStep("details");
              updateUrl({ step: "details" });
              return;
            }
            if (mobileStep !== "amount") {
              const nextStep = mobileStep === "review" ? "details" : "amount";
              setMobileStep(nextStep);
              updateUrl({ step: nextStep });
              return;
            }
            router.back();
          }}
          className="absolute left-0 cursor-pointer rounded-full border border-black/5 bg-white p-2 text-gray-600 transition-all hover:bg-gray-50 dark:border-white/10 dark:bg-secondary-50 dark:text-gray-300 dark:hover:bg-secondary-60/50"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <h1 className="text-lg font-semibold text-black dark:text-white">
          {mobileStep === "review" || isDesktopReview
            ? "Review Invoice"
            : "Create Invoice"}
        </h1>
      </header>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(submitInvoice)}>
          <div className="mb-8 md:hidden">
            <StepIndicator
              currentStep={INVOICE_STEPS.indexOf(mobileStep)}
              totalSteps={INVOICE_STEPS.length}
            />
          </div>

          <div className="space-y-5 md:hidden">
            {mobileStep === "amount" ? amountSection : null}
            {mobileStep === "details" ? (
              <>
                {customerSection}
                {descriptionSection}
                {expirySection}
              </>
            ) : null}
            {mobileStep === "review" ? reviewSection : null}

            <div className="sticky bottom-0 -mx-4 px-4 pb-4 pt-5">
              {mobileStep === "amount" ? (
                <FlowActionFooter
                  sticky={false}
                  onClick={goToMobileDetails}
                  textClassName="text-sm"
                  helperText="Choose the asset and amount you want this customer to pay."
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </FlowActionFooter>
              ) : null}

              {mobileStep === "details" ? (
                <FlowActionFooter
                  sticky={false}
                  onClick={goToMobileReview}
                  disabled={isBusy || !isCurrentCustomerVerified}
                  textClassName="text-sm"
                  helperText="We verify the customer before you create the invoice."
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </FlowActionFooter>
              ) : null}

              {mobileStep === "review" ? (
                <FlowActionFooter
                  sticky={false}
                  type="submit"
                  disabled={isBusy || !isCurrentCustomerVerified}
                  textClassName="text-sm"
                  helperText="Confirm the details before generating this payment request."
                >
                  {form.formState.isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  Create Invoice
                </FlowActionFooter>
              ) : null}
            </div>
          </div>

          <div className="hidden md:block">
            {isDesktopReview ? (
              <div className="space-y-8">
                {reviewSection}
                <div className="mx-auto flex w-full max-w-xl gap-3 border-t border-black/5 pt-6 dark:border-white/5">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 flex-1 rounded-2xl"
                    onClick={() => {
                      setIsDesktopReview(false);
                      updateUrl({ step: "details" });
                    }}
                  >
                    Edit Details
                  </Button>
                  <FlowActionFooter
                    sticky={false}
                    type="submit"
                    className="flex-1"
                    disabled={isBusy || !isCurrentCustomerVerified}
                  >
                    {form.formState.isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    Create Invoice
                  </FlowActionFooter>
                </div>
                <p className="mx-auto max-w-xl px-4 text-center text-xs leading-relaxed text-gray-400">
                  Confirm the invoice details before generating the payment
                  request.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 items-start gap-5">
                <div className="flex flex-col gap-5">
                  {amountSection}
                  {descriptionSection}
                </div>
                <div className="flex flex-col gap-5">
                  {customerSection}
                  {expirySection}
                  <FlowActionFooter
                    sticky={false}
                    onClick={goToDesktopReview}
                    disabled={isBusy || !isCurrentCustomerVerified}
                    helperText="Add the invoice details and verify the Kellon customer before review."
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </FlowActionFooter>
                </div>
              </div>
            )}
          </div>
        </form>
      </Form>
    </section>
  );
}
