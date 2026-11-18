"use client";

import { chainStatus } from "@/lib/chain-status";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getBestRateProviderId } from "@/lib/provider-rate-display";
import { useBuyCryptoState, STEPS } from "@/hooks/use-buy-cypto-state";
import type { Step } from "@/hooks/use-buy-cypto-state";
import type { BankDetail, Transaction } from "@/types/db";
import { useCountryDetection } from "@/hooks/use-country-detection";
import {
  getCurrencyForCountry,
  getCurrencySymbol,
  getCurrencyDecimals,
} from "@/lib/country-currency-map";
import { getChainById, getActiveChainKey } from "@/lib/chains";
import { MIN_STABLECOIN_AMOUNT } from "@/lib/stablecoin-amounts";
import { getTransactionDetailsPath } from "@/lib/transaction-navigation";
import { ACTIVE_PAYMENT_RAIL, getPaymentRailConfig } from "@/lib/payment-rails";
import { CountrySelectorModal } from "@/components/modals/CountrySelectorModal";
import { KycDialog } from "@/components/kyc/KycDialog";
import { kycRequiredFrom } from "@/services/api/kyc";
import { SUPPORTED_RAMP_COUNTRIES } from "@/lib/supported-countries";
import { useExchangeRate } from "@/hooks/use-exchange-rate";
import { useUser } from "@/hooks/use-user";
import { useProviders } from "@/hooks/use-provider";
import { useProviderRates } from "@/hooks/use-provider-rates";
import { bankService } from "@/services/api/bank";
import { transactionService } from "@/services/api/transactions";
import FlowHeader from "@/components/wallet/shared/FlowHeader";
import {
  extractOnrampTransferInstructions,
  getCentiivPollingReferences,
  normalizeOnrampTransferInstructions,
  onrampService,
  type OnrampInitRequest,
  type OnrampResponse,
} from "@/services/api/on-ramp";
import SelectBankModal, {
  type SelectableBank,
} from "@/components/modals/SelectBankModal";
import StepIndicator from "@/components/wallet/shared/FlowStepIndicator";
import { AssetSelectionStep } from "./steps/AssetSelectionStep";
import { AmountEntryStep } from "./steps/AmountEntryStep";
import { BuyBankSelectionStep } from "./steps/BankSelectionStep";
import { ReviewStep } from "./steps/ReviewStep";
import { BuySuccessModal } from "./BuySuccessModal";

const CENTIIV_POLL_INTERVAL_MS = 3_000;
const CENTIIV_MAX_POLL_ATTEMPTS = 20;
const DEFAULT_FLOW_STEPS = ["asset", "amount", "review"] as const;
type VisibleFlowStep = (typeof DEFAULT_FLOW_STEPS)[number] | Step;
type ProviderRateSnapshot = {
  cryptoAmount: number | null;
  fiatAmount: number | null;
  rawRate: number | null;
  routeProvider?: string;
};

function getOnrampReferenceCandidates(
  order: OnrampResponse | null,
): Record<string, string | undefined> {
  return {
    "transaction.id": order?.transaction?.id,
    "transaction.transactionId": order?.transaction?.transactionId,
    "order.transactionId": order?.order?.transactionId,
    transactionId: order?.transactionId,
    transactionReference: order?.transactionReference,
    txId: order?.txId,
    id: order?.id,
    orderId: order?.orderId,
    reference: order?.reference,
    providerReference: order?.providerReference,
    "order.id": order?.order?.id,
    "order.reference": order?.order?.reference,
    "paymentDetails.reference": order?.paymentDetails?.reference,
  };
}

function getReferenceValues(value: unknown, depth = 0): string[] {
  if (depth > 4 || value === null || value === undefined) return [];
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (typeof value === "number" && Number.isFinite(value)) {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => getReferenceValues(item, depth + 1));
  }
  if (typeof value !== "object") return [];

  return Object.values(value as Record<string, unknown>).flatMap((item) =>
    getReferenceValues(item, depth + 1),
  );
}

function transactionMatchesOnrampReferences(
  transaction: Transaction,
  references: Set<string>,
): boolean {
  const transactionReferences = new Set([
    transaction.id,
    transaction.providerReference || "",
    transaction.userOpHash || "",
    ...getReferenceValues(transaction.metadata),
  ]);

  return [...references].some((reference) =>
    transactionReferences.has(reference),
  );
}

async function resolveOnrampTransactionId(
  order: OnrampResponse | null,
): Promise<string | null> {
  const references = new Set(
    Object.values(getOnrampReferenceCandidates(order)).filter(
      (value): value is string => Boolean(value?.trim()),
    ),
  );

  if (references.size === 0) return null;

  // The nested transaction ID is the only response value guaranteed to be a
  // Kellon transaction ID. Validate it before using it in the detail route.
  const directTransactionId = order?.transaction?.id;
  if (directTransactionId) {
    try {
      const response =
        await transactionService.getTransaction(directTransactionId);
      if (response.data?.id) return response.data.id;
    } catch {
      // The transaction can take a moment to appear in the read API.
    }
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await transactionService.getTransactions();
      const match = response.data
        ?.filter((transaction) => transaction.type === "BUY")
        .find((transaction) =>
          transactionMatchesOnrampReferences(transaction, references),
        );

      if (match?.id) return match.id;
    } catch {
      // Retry briefly before falling back to transaction history.
    }

    if (attempt < 2) {
      await new Promise((resolve) => window.setTimeout(resolve, 750));
    }
  }

  return null;
}

export default function BuyCryptoFlow({
  onAttemptClose,
}: {
  onAttemptClose: (hasStarted: boolean) => void;
}) {
  const router = useRouter();
  const {
    step,
    asset,
    networkName,
    networkId,
    amount,
    country,
    countrySource,
    bankId,
    setAsset,
    setNetwork,
    setAmount,
    setCountryAndCurrency,
    setBankId,
    setStep,
  } = useBuyCryptoState();
  const { data: profile } = useUser();

  // Local UI state
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const paymentRail = ACTIVE_PAYMENT_RAIL;
  const paymentRailConfig = getPaymentRailConfig(paymentRail);
  const paymentMethod = paymentRailConfig.apiValue;
  const [savedBanks, setSavedBanks] = useState<BankDetail[]>([]);
  const [selectedProviderBank, setSelectedProviderBank] =
    useState<SelectableBank | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [kycPrompt, setKycPrompt] = useState<{ country: string } | null>(null);
  const [initializedOrder, setInitializedOrder] =
    useState<OnrampResponse | null>(null);
  const [isCompletingOrder, setIsCompletingOrder] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [resolvedTransactionId, setResolvedTransactionId] =
    useState<string | null>(null);
  const [isSyncingTransaction, setIsSyncingTransaction] = useState(false);
  const [isFetchingInstructions, setIsFetchingInstructions] = useState(false);
  const [instructionsError, setInstructionsError] = useState<string | null>(
    null,
  );
  const [providerRateSnapshots, setProviderRateSnapshots] = useState<
    Record<string, ProviderRateSnapshot>
  >({});

  // Track if amount was set via input (desktop) or keypad (mobile)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isDesktopAmountValid, setIsDesktopAmountValid] = useState(false);

  // Country detection (stable callback)
  const handleCountryDetected = useCallback(
    (detectedCountry: string, detectedCurrency: string) => {
      setCountryAndCurrency(detectedCountry, detectedCurrency, "auto");
    },
    [setCountryAndCurrency],
  );

  const { isDetecting: isDetectingCountry } = useCountryDetection(
    country,
    countrySource,
    handleCountryDetected,
  );

  // Derived values
  const fiatCurrency = useMemo(
    () => getCurrencyForCountry(country || "US"),
    [country],
  );
  const fiatSymbol = useMemo(
    () => getCurrencySymbol(fiatCurrency),
    [fiatCurrency],
  );
  const decimals = useMemo(
    () => getCurrencyDecimals(fiatCurrency),
    [fiatCurrency],
  );
  const selectedChain = useMemo(
    () => (networkId ? getChainById(networkId) : null),
    [networkId],
  );

  // Exchange rate
  const { exchangeRate, isRateLoading } = useExchangeRate(fiatCurrency, asset);

  // Providers
  const {
    providers,
    selectedProviderId,
    setSelectedProviderId,
    isLoadingProviders,
  } = useProviders(country, asset, networkName, fiatCurrency);

  // Derived amount values
  const cryptoAmountValue = useMemo(() => {
    if (!amount || exchangeRate === 0) return 0;
    return Number(amount) / exchangeRate;
  }, [amount, exchangeRate]);

  const isAmountValid = useMemo(() => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return false;
    return cryptoAmountValue >= MIN_STABLECOIN_AMOUNT;
  }, [cryptoAmountValue, amount]);

  const fiatAmountNum = useMemo(() => parseFloat(amount) || 0, [amount]);

  // Provider-specific rates (live whenever inputs are valid)
  const showRates = isAmountValid && fiatAmountNum > 0;
  const { rates: providerRates, isLoadingRates } = useProviderRates({
    providers: showRates ? providers : [],
    asset,
    amount: fiatAmountNum,
    currency: fiatCurrency,
    networkName,
    isAmountValid: showRates,
    isLoadingProviders,
  });

  // Auto-select best rate provider, recommended, or first provider if not chosen yet
  const userManuallySelectedRef = useRef(false);

  useEffect(() => {
    userManuallySelectedRef.current = false;
  }, [asset, fiatCurrency, networkName]);

  useEffect(() => {
    if (providers.length === 0) return;

    const bestId = getBestRateProviderId(providers, providerRates, "buy");

    // Auto-select best rate provider as rates load if user hasn't made a manual choice
    if (!userManuallySelectedRef.current && bestId) {
      if (bestId !== selectedProviderId) {
        setSelectedProviderId(bestId);
      }
      return;
    }

    const currentIsValid =
      selectedProviderId && providers.some((p) => p.id === selectedProviderId);

    if (!currentIsValid) {
      const target =
        (bestId && providers.find((p) => p.id === bestId)) ||
        providers.find((p) => p.isRecommended) ||
        providers[0];
      if (target && target.id !== selectedProviderId) {
        setSelectedProviderId(target.id);
      }
    }
  }, [providers, selectedProviderId, providerRates, setSelectedProviderId]);

  // If URL somehow opens step=provider, redirect to amount
  useEffect(() => {
    if ((step as string) === "provider") {
      setStep("amount");
    }
  }, [step, setStep]);
  const selectedProvider =
    providers.find((provider) => provider.id === selectedProviderId) || null;
  const selectedProviderRate = selectedProviderId
    ? providerRates[selectedProviderId] ||
      providerRateSnapshots[selectedProviderId] ||
      null
    : null;
  const selectedProviderRawRate =
    selectedProviderRate?.rawRate && selectedProviderRate.rawRate > 0
      ? selectedProviderRate.rawRate
      : undefined;
  const hasSelectedProviderRate = Boolean(selectedProviderRawRate);
  const selectedBank = savedBanks.find((bank) => bank.id === bankId) || null;

  useEffect(() => {
    setProviderRateSnapshots({});
  }, [asset, fiatAmountNum, fiatCurrency, networkName]);

  useEffect(() => {
    setProviderRateSnapshots((currentSnapshots) => {
      let hasChanges = false;
      const nextSnapshots = { ...currentSnapshots };

      Object.entries(providerRates).forEach(([providerId, rateDetails]) => {
        if (!rateDetails?.rawRate || rateDetails.rawRate <= 0) return;

        const currentRate = currentSnapshots[providerId];
        if (
          currentRate?.rawRate === rateDetails.rawRate &&
          currentRate?.cryptoAmount === rateDetails.cryptoAmount &&
          currentRate?.fiatAmount === rateDetails.fiatAmount
        ) {
          return;
        }

        nextSnapshots[providerId] = {
          cryptoAmount: rateDetails.cryptoAmount,
          fiatAmount: rateDetails.fiatAmount,
          rawRate: rateDetails.rawRate,
          routeProvider: rateDetails.routeProvider,
        };
        hasChanges = true;
      });

      return hasChanges ? nextSnapshots : currentSnapshots;
    });
  }, [providerRates]);

  const requiresRefundBank =
    selectedProvider?.name?.toLowerCase() === "paycrest";
  const flowSteps = useMemo(
    (): readonly VisibleFlowStep[] =>
      requiresRefundBank ? STEPS : DEFAULT_FLOW_STEPS,
    [requiresRefundBank],
  );
  const currentStepIndex = Math.max(0, flowSteps.indexOf(step));
  const hasTransferInstructions = Boolean(initializedOrder?.providerAccount);
  const isCentiivOrderInitialized = Boolean(
    initializedOrder && selectedProvider?.name?.toLowerCase() === "centiiv",
  );
  const stepTitle =
    step === "amount"
      ? "Enter Amount"
      : step === "bank"
        ? "Refund Account"
        : step === "review"
          ? hasTransferInstructions || isCentiivOrderInitialized
            ? "Transfer Instructions"
            : "Review Order"
          : "Buy Crypto";

  useEffect(() => {
    let cancelled = false;

    const loadBanks = async () => {
      try {
        const response = await bankService.getBanks();
        if (!cancelled) {
          setSavedBanks(response.data || []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load banks", error);
        }
      }
    };

    loadBanks();

    return () => {
      cancelled = true;
    };
  }, []);

  // Handlers
  const handleKeypadPress = (val: string) => {
    let nextAmount = amount;
    if (val === "clear") {
      nextAmount = "";
    } else if (val === "delete") {
      nextAmount = amount.slice(0, -1);
    } else if (val === "." && (amount.includes(".") || decimals === 0)) {
      return;
    } else if (amount === "0" && val !== ".") {
      nextAmount = val;
    } else {
      nextAmount = amount + val;
    }
    setAmount(nextAmount);
  };

  const handleAmountChange = (value: string) => {
    // Validate amount format (allow numbers with up to 2 decimals)
    const regex = /^\d*\.?\d{0,2}$/;
    if (regex.test(value) || value === "") {
      setAmount(value);
      // Validate if amount is valid
      const numValue = parseFloat(value);
      const isValid = !isNaN(numValue) && numValue > 0;
      setIsDesktopAmountValid(isValid);
    }
  };

  const confirmPurchase = async () => {
    if (
      !selectedProvider ||
      !asset ||
      !networkName ||
      !fiatAmountNum ||
      !hasSelectedProviderRate ||
      (requiresRefundBank && !selectedBank)
    ) {
      toast.error(
        !hasSelectedProviderRate
          ? "Rate unavailable. Please select a provider with an active rate."
          : "Complete the order details before initializing payment",
      );
      return;
    }

    setIsSubmitting(true);
    setInitializedOrder(null);
    setInstructionsError(null);
    try {
      const chainBlocked = chainStatus.blockedMessage(networkName, "in");
      if (chainBlocked) throw new Error(chainBlocked);
      const targetChainKey =
        getActiveChainKey(networkName) || networkName?.toLowerCase();
      const account = profile?.chainAccounts?.find(
        (a) =>
          a.chain?.toLowerCase() === targetChainKey ||
          a.chain?.toLowerCase() === networkName?.toLowerCase(),
      );
      const walletAddress =
        account?.smartAccountAddress || account?.publicKey || undefined;

      const payload: OnrampInitRequest = {
        fiatAmount: fiatAmountNum,
        fiatCurrency,
        cryptoCurrencyCode: asset,
        cryptocurrency: asset,
        asset,
        token: asset,
        chain: targetChainKey || networkName,
        network: networkName,
        rate: selectedProviderRawRate,
        paymentMethod,
        providerId: selectedProvider.id,
        source: "web",
        walletAddress,
      };

      if (selectedBank) {
        payload.bankId = selectedBank.id;
        payload.bankAccountId = selectedBank.id;
        payload.refundBankId = selectedBank.id;
        payload.refundAccount = {
          bankName: selectedBank.bankName,
          bankCode: selectedBank.bankCode,
          accountNumber: selectedBank.accountNumber,
          accountName: selectedBank.accountName,
        };
      }

      const providerName = selectedProvider.name.toLowerCase();
      let response;

      if (providerName === "paycrest") {
        response = await onrampService.initiatePaycrest(payload);
      } else if (providerName === "centiiv") {
        response = await onrampService.initiateCentiiv(payload);
      } else if (providerName === "transak") {
        response = await onrampService.initiateTransak(payload);
      } else if (providerName === "moonpay") {
        response = await onrampService.initiateMoonpay(payload);
      } else if (providerName === "quidax") {
        response = await onrampService.initiateQuidax(payload);
      } else if (providerName === "paychant") {
        response = await onrampService.initiatePaychant(payload);
      } else if (providerName === "paybis") {
        response = await onrampService.initiatePaybis(payload);
      } else if (providerName === "ramphub") {
        response = await onrampService.initiateRamphub(payload);
      } else {
        response = await onrampService.initiateRamp(payload);
      }

      const redirectUrl =
        response.data?.checkoutUrl ||
        response.data?.paymentUrl ||
        response.data?.redirectUrl ||
        response.data?.url;

      if (redirectUrl) {
        toast.success("Payment initialized. Redirecting...");
        window.location.assign(redirectUrl);
        return;
      }

      const initializedResponse = response.data
        ? normalizeOnrampTransferInstructions(
            response.data,
            fiatCurrency,
            fiatAmountNum,
          )
        : null;

      if (initializedResponse?.providerAccount) {
        setInitializedOrder(initializedResponse);
        toast.success(
          initializedResponse.message ||
            "Payment details ready. Send the exact amount.",
        );
        return;
      }

      if (providerName === "centiiv" && initializedResponse) {
        setInitializedOrder(initializedResponse);
        toast.success("Payment initialized. Fetching account details...");
        await pollCentiivTransferInstructions(initializedResponse);
        return;
      }

      const successMessage =
        response.data?.message ||
        (response.data?.paymentDetails
          ? "Payment initialized. Use the payment details to complete your order."
          : "Payment initialized");

      toast.success(successMessage);
    } catch (error) {
      const kyc = kycRequiredFrom(error);
      if (kyc) {
        setKycPrompt({ country: kyc.country || country || "" });
        return;
      }
      toast.error(
        error instanceof Error ? error.message : "Unable to initialize payment",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const pollCentiivTransferInstructions = useCallback(
    async (order: OnrampResponse): Promise<boolean> => {
      const { orderId, transactionId } = getCentiivPollingReferences(order);
      setIsFetchingInstructions(true);
      setInstructionsError(null);

      if (!orderId && !transactionId) {
        setIsFetchingInstructions(false);
        setInstructionsError(
          "The payment was initialized, but no tracking reference was returned.",
        );
        return false;
      }

      for (let attempt = 0; attempt < CENTIIV_MAX_POLL_ATTEMPTS; attempt++) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, CENTIIV_POLL_INTERVAL_MS),
        );

        let providerAccount = null;

        if (orderId) {
          try {
            const orderResponse =
              await onrampService.getCentiivOrderStatus(orderId);
            providerAccount = extractOnrampTransferInstructions(
              orderResponse.data,
              fiatCurrency,
              fiatAmountNum,
            );
          } catch {
            // The transaction record below is the fallback when order polling
            // is temporarily unavailable or the webhook has already landed.
          }
        }

        if (!providerAccount && transactionId) {
          try {
            const transactionResponse =
              await transactionService.getTransaction(transactionId);
            providerAccount = extractOnrampTransferInstructions(
              transactionResponse.data,
              fiatCurrency,
              fiatAmountNum,
            );
          } catch {
            // Keep polling: Centiiv may still be assigning the virtual account.
          }
        }

        if (providerAccount) {
          setInitializedOrder((currentOrder) => ({
            ...(currentOrder || order),
            providerAccount,
          }));
          setIsFetchingInstructions(false);
          toast.success("Transfer account ready");
          return true;
        }
      }

      setIsFetchingInstructions(false);
      setInstructionsError(
        "Bank details are taking longer than expected. Retry without creating another payment.",
      );
      return false;
    },
    [fiatAmountNum, fiatCurrency],
  );

  const retryCentiivInstructions = useCallback(() => {
    if (!initializedOrder || isFetchingInstructions) return;
    void pollCentiivTransferInstructions(initializedOrder);
  }, [
    initializedOrder,
    isFetchingInstructions,
    pollCentiivTransferInstructions,
  ]);

  const confirmMoneySent = async () => {
    setIsCompletingOrder(true);
    setIsSuccessModalOpen(true);
    setIsSyncingTransaction(true);

    try {
      let transactionId = await resolveOnrampTransactionId(initializedOrder);

      // If not immediately found, try a couple background polling attempts
      if (!transactionId) {
        for (let extra = 0; extra < 4; extra += 1) {
          await new Promise((r) => setTimeout(r, 2000));
          transactionId = await resolveOnrampTransactionId(initializedOrder);
          if (transactionId) break;
        }
      }

      if (transactionId) {
        setResolvedTransactionId(transactionId);
      }
    } catch {
      // Background sync will continue or user can view in transactions
    } finally {
      setIsSyncingTransaction(false);
      setIsCompletingOrder(false);
    }
  };

  const handleSuccessDone = () => {
    setIsSuccessModalOpen(false);
    router.push("/");
  };

  const handleViewTransactions = () => {
    setIsSuccessModalOpen(false);
    if (resolvedTransactionId) {
      router.push(getTransactionDetailsPath(resolvedTransactionId, "flow"));
    } else {
      // Safe fallback: open general transactions page rather than an unindexed detail route
      router.push("/transactions");
    }
  };

  // Step navigation
  const goBack = () => {
    if (step === "amount") setStep("asset");
    else if (step === "bank") setStep("amount");
    else if (step === "review")
      setStep(requiresRefundBank ? "bank" : "amount");
    else onAttemptClose(false);
  };

  // Sync amount validity for desktop
  useEffect(() => {
    if (step === "amount") {
      // Ensure amount validity is in sync
      const isValid =
        parseFloat(amount) > 0 && cryptoAmountValue >= MIN_STABLECOIN_AMOUNT;
      setIsDesktopAmountValid(isValid);
    }
  }, [amount, cryptoAmountValue, step]);

  return (
    <div className="container mx-auto flex min-h-[100dvh] max-w-2xl flex-col pb-[env(safe-area-inset-bottom)] md:min-h-[90dvh] md:pb-32 md:pt-20">
      <FlowHeader
        title={stepTitle}
        onBack={goBack}
        onClose={() => onAttemptClose(true)}
        closeLabel="Close buy flow"
        className="mb-4 px-3 pt-2 sm:mb-8 sm:px-4 sm:pt-4"
      />

      <StepIndicator
        currentStep={currentStepIndex}
        totalSteps={flowSteps.length}
      />

      <div
        className={`mx-auto flex w-full max-w-md flex-1 flex-col px-3 sm:px-4 md:w-lg md:max-w-2xl md:px-0 ${
          step === "asset" ? "pt-4" : "pt-1"
        }`}
      >
        {step === "asset" && (
          <AssetSelectionStep
            asset={asset}
            networkName={networkName}
            networkId={networkId}
            country={country}
            isDetectingCountry={isDetectingCountry}
            onSelectAsset={setAsset}
            onSelectNetwork={setNetwork}
            onOpenCountryModal={() => setIsCountryModalOpen(true)}
            onContinue={() => setStep("amount")}
          />
        )}

        {step === "amount" && (
          <AmountEntryStep
            asset={asset}
            networkName={networkName}
            selectedChain={selectedChain}
            amount={amount}
            fiatCurrency={fiatCurrency}
            fiatSymbol={fiatSymbol}
            decimals={decimals}
            cryptoAmountValue={cryptoAmountValue}
            exchangeRate={exchangeRate}
            isRateLoading={isRateLoading}
            isAmountValid={isAmountValid}
            paymentRail={paymentRail}
            paymentMethodLabel={paymentRailConfig.label}
            providers={providers}
            selectedProviderId={selectedProviderId}
            onSelectProvider={(id) => {
              userManuallySelectedRef.current = true;
              setSelectedProviderId(id);
            }}
            providerRates={providerRates}
            isRatesLoading={isLoadingRates}
            onKeypadPress={handleKeypadPress}
            onContinue={() => {
              if (isAmountValid) {
                if (!hasSelectedProviderRate && selectedProvider) {
                  toast.error(
                    "Rate unavailable. Please select another provider or try again.",
                  );
                  return;
                }
                setStep(requiresRefundBank ? "bank" : "review");
              }
            }}
            onAmountChange={handleAmountChange}
          />
        )}

        {step === "bank" && (
          <BuyBankSelectionStep
            asset={asset}
            amount={amount}
            fiatCurrency={fiatCurrency}
            country={country}
            selectedChain={selectedChain}
            selectedBank={selectedBank}
            savedBanks={savedBanks}
            selectedProviderName={selectedProvider?.name || null}
            routeProvider={selectedProviderRate?.routeProvider || null}
            selectedProviderBank={selectedProviderBank}
            onSelectProviderBank={(bank) => {
              setSelectedProviderBank(bank);
              if (bank) setBankId(null);
            }}
            onSelectSavedBank={(bank) => {
              setSelectedProviderBank(null);
              setBankId(bank.id);
            }}
            onOpenBankModal={() => setIsBankModalOpen(true)}
            onAddVerifiedBank={(bank) => {
              setSavedBanks((current) => {
                const exists = current.some((item) => item.id === bank.id);
                return exists ? current : [bank, ...current];
              });
              setBankId(bank.id);
            }}
            onContinue={() => selectedBank && setStep("review")}
          />
        )}

        {step === "review" && (
          <ReviewStep
            amount={amount}
            asset={asset}
            fiatCurrency={fiatCurrency}
            fiatSymbol={fiatSymbol}
            selectedChain={selectedChain}
            selectedProvider={selectedProvider}
            estimatedCrypto={
              selectedProviderRate?.cryptoAmount || cryptoAmountValue
            }
            selectedBank={selectedBank}
            paymentRail={paymentRail}
            isSubmitting={isSubmitting}
            initializedOrder={initializedOrder}
            isCompleting={isCompletingOrder}
            isFetchingInstructions={isFetchingInstructions}
            instructionsError={instructionsError}
            onConfirm={confirmPurchase}
            onConfirmSent={confirmMoneySent}
            onRetryInstructions={retryCentiivInstructions}
          />
        )}
      </div>

      <CountrySelectorModal
        isVisible={isCountryModalOpen}
        onClose={() => setIsCountryModalOpen(false)}
        selectedCountry={country || "NG"}
        countries={SUPPORTED_RAMP_COUNTRIES}
        onSelect={(code) => {
          setCountryAndCurrency(code, getCurrencyForCountry(code), "manual");
        }}
      />

      <SelectBankModal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        currency={fiatCurrency}
        providerName={selectedProvider?.name || null}
        routeProvider={selectedProviderRate?.routeProvider || null}
        selectedBankCode={selectedProviderBank?.value || null}
        onSelectBank={(bank) => {
          setSelectedProviderBank(bank);
          setBankId(null);
        }}
      />
      <KycDialog
        open={kycPrompt !== null}
        onOpenChange={(open) => {
          if (!open) setKycPrompt(null);
        }}
        country={kycPrompt?.country}
        reason={`${selectedProvider?.name || "This provider"} needs your identity details before this purchase. Save them, then confirm again.`}
      />
      <BuySuccessModal
        open={isSuccessModalOpen}
        onDone={handleSuccessDone}
        onViewTransactions={handleViewTransactions}
        amount={amount}
        fiatCurrency={fiatCurrency}
        asset={asset}
        networkName={selectedChain?.name || networkName}
        estimatedCrypto={
          selectedProviderRate?.cryptoAmount || cryptoAmountValue
        }
        providerName={selectedProvider?.name}
        resolvedTransactionId={resolvedTransactionId}
        isSyncingTransaction={isSyncingTransaction}
      />
    </div>
  );
}
