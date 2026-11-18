"use client";

import { chainStatus } from "@/lib/chain-status";
import { formatNumberWithCommas } from "@/lib/format-number-with-comma";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { BankDetail, User } from "@/types/db";
import { useWithdrawState, WITHDRAW_STEPS } from "@/hooks/use-withdraw-state";
import { useCountryDetection } from "@/hooks/use-country-detection";
import { getCurrencyForCountry } from "@/lib/country-currency-map";
import { getChainById } from "@/lib/chains";
import { getBestRateProviderId } from "@/lib/provider-rate-display";
import {
  isStablecoinAmountWithinBalance,
  MIN_STABLECOIN_AMOUNT,
} from "@/lib/stablecoin-amounts";
import { ACTIVE_PAYMENT_RAIL } from "@/lib/payment-rails";
import { useProviders } from "@/hooks/use-provider";
import { useProviderRates } from "@/hooks/use-provider-rates";
import { CountrySelectorModal } from "@/components/modals/CountrySelectorModal";
import { SUPPORTED_RAMP_COUNTRIES } from "@/lib/supported-countries";
import { ExitConfirmation } from "@/components/modals/ExitComfirmationModal";
import { bankService } from "@/services/api/bank";
import {
  OfframpApiError,
  OfframpVerificationRequiredError,
  offrampService,
  type OfframpInitRequest,
  type OfframpResponse,
  type OfframpTermsSide,
} from "@/services/api/off-ramp";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TransferVerificationModal from "@/components/wallet/send/TransferVerificationModal";
import BridgeFundingOverlay, {
  type BridgeFundingRequest,
} from "@/components/wallet/bridge/BridgeFundingOverlay";
import FlowHeader from "@/components/wallet/shared/FlowHeader";
import StepIndicator from "@/components/wallet/shared/FlowStepIndicator";
import { WithdrawAssetSelectionStep } from "./steps/AssetSelectionStep";
import { WithdrawAmountEntryStep } from "./steps/AmountEntryStep";
import { WithdrawBankSelectionStep } from "./steps/BankSelectionStep";
import { WithdrawReviewStep } from "./steps/ReviewStep";
import SelectBankModal, {
  type SelectableBank,
} from "../../modals/SelectBankModal";
import {
  findTransferVerificationRequiredError,
  getAvailableVerificationMethods,
  getOtpChannelForMethod,
  getVerificationTypeForMethod,
  resolveVerificationMethod,
  transferService,
  type VerificationMethod,
  type VerificationType,
} from "@/services/api/transfers";
import { transactionService } from "@/services/api/transactions";
import { beginOperation, endOperation } from "@/services/api";
import { getTransactionDetailsPath } from "@/lib/transaction-navigation";
import {
  useOfframpFunding,
  getPendingDeposit,
} from "@/hooks/useOfframpFunding";
import { getWithdrawableAssets } from "@/lib/withdraw-assets";
import { useUser } from "@/hooks/use-user";
import { getOrCreateOfframpOrder } from "@/lib/offramp-retry";
import {
  getEnabledTransactionVerificationMethods,
  securityService,
} from "@/services/api/security";

function getOfframpReferenceCandidates(
  order: OfframpResponse | null,
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
  };
}

function getOfframpTransactionReference(order: OfframpResponse | null): string {
  const candidates = getOfframpReferenceCandidates(order);
  return Object.values(candidates).find(Boolean) || "";
}

function normalizeProviderKey(name: string): string {
  return name.toLowerCase().replace(/[\s_-]+/g, "");
}

export default function WithdrawFlow({
  profile,
  onAttemptClose,
}: {
  profile: User;
  onAttemptClose: (hasStarted: boolean) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    step,
    asset,
    networkName,
    networkId,
    amount,
    country,
    currency,
    countrySource,
    providerId,
    bankId,
    setStep,
    setAsset,
    setAssetAndNetwork,
    setAmount,
    setCountryAndCurrency,
    setProviderId,
    setBankId,
  } = useWithdrawState();
  const { data: liveProfile } = useUser(profile, { live: true });
  const activeProfile = liveProfile || profile;

  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [selectedProviderBank, setSelectedProviderBank] =
    useState<SelectableBank | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [bridgeRequest, setBridgeRequest] =
    useState<BridgeFundingRequest | null>(null);
  const [savedBanks, setSavedBanks] = useState<BankDetail[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [verificationRequest, setVerificationRequest] = useState<{
    verificationType: VerificationType;
    verificationMethod: VerificationMethod;
    availableMethods: VerificationMethod[];
    otpSent: boolean;
    action?: string;
    request?: {
      providerName: string;
      payload: OfframpInitRequest;
    };
    order?: OfframpResponse;
  } | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const withdrawalInFlightRef = useRef(false);

  const { fundOfframpOrder } = useOfframpFunding();

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

  const fiatCurrency = useMemo(
    () => currency || getCurrencyForCountry(country || "NG"),
    [country, currency],
  );
  const payoutCountry = country || "NG";

  const selectedChain = useMemo(
    () => (networkId ? getChainById(networkId) : null),
    [networkId],
  );

  const withdrawableAssets = useMemo(
    () => getWithdrawableAssets(activeProfile.assets || []),
    [activeProfile.assets],
  );

  const {
    providers,
    selectedProviderId,
    setSelectedProviderId,
    isLoadingProviders,
  } = useProviders(country, asset, networkName, fiatCurrency, "sell");

  useEffect(() => {
    if (providerId) {
      if (providerId !== selectedProviderId) {
        setSelectedProviderId(providerId);
      }
    }
  }, [providerId, selectedProviderId, setSelectedProviderId]);

  useEffect(() => {
    if ((step as string) === "provider") {
      setStep("amount");
    }
  }, [step, setStep]);

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

  const selectedBank = savedBanks.find((bank) => bank.id === bankId) || null;
  const selectedProvider =
    providers.find((provider) => provider.id === selectedProviderId) || null;
  const selectedAssetDetails =
    withdrawableAssets.find(
      (item) =>
        item.symbol === asset &&
        (item.network.id === networkId ||
          item.network.name.toLowerCase() === networkName?.toLowerCase()),
    ) || null;
  const selectedAssetBalance = selectedAssetDetails?.balance || 0;
  const amountValue = Number(amount);
  const isAmountValid =
    Number.isFinite(amountValue) &&
    amountValue >= MIN_STABLECOIN_AMOUNT &&
    isStablecoinAmountWithinBalance(amountValue, selectedAssetBalance);
  const {
    rates: providerRates,
    isLoadingRates,
    refreshQuotes,
    applyQuote,
  } = useProviderRates({
    providers,
    asset,
    amount: amountValue,
    currency: fiatCurrency,
    networkName,
    isAmountValid,
    isLoadingProviders,
    side: "sell",
  });

  const initialProviderParamRef = useRef(searchParams.get("providerId"));
  const userManuallySelectedRef = useRef(
    Boolean(initialProviderParamRef.current),
  );

  useEffect(() => {
    userManuallySelectedRef.current = false;
  }, [asset, payoutCountry, fiatCurrency, networkName]);

  useEffect(() => {
    if (providers.length === 0) return;

    const bestId = getBestRateProviderId(providers, providerRates, "withdraw");

    // Auto-select best rate provider as rates load if user hasn't made a manual choice
    if (!userManuallySelectedRef.current && bestId) {
      if (bestId !== selectedProviderId) {
        setSelectedProviderId(bestId);
        setProviderId(bestId);
      }
      return;
    }

    const currentId = selectedProviderId || providerId;
    const currentIsValid = currentId && providers.some((p) => p.id === currentId);

    if (!currentIsValid) {
      const target =
        (bestId && providers.find((p) => p.id === bestId)) ||
        providers.find((p) => p.isRecommended) ||
        providers[0];
      if (target && target.id !== selectedProviderId) {
        setSelectedProviderId(target.id);
        setProviderId(target.id);
      }
    }
  }, [providers, selectedProviderId, providerId, providerRates, setSelectedProviderId, setProviderId]);
  const selectedProviderRate = selectedProviderId
    ? providerRates[selectedProviderId]
    : null;
  const selectedProviderRawRate =
    selectedProviderRate?.rawRate && selectedProviderRate.rawRate > 0
      ? selectedProviderRate.rawRate
      : undefined;
  const hasSelectedProviderRate = Boolean(
    selectedProviderRawRate &&
      selectedProviderRate?.fiatAmount &&
      selectedProviderRate?.quoteId,
  );
  const estimatedFiatAmount =
    selectedProviderRate?.fiatAmount && selectedProviderRate.fiatAmount > 0
      ? selectedProviderRate.fiatAmount
      : 0;
  const withdrawalCryptoAmount =
    selectedProviderRate?.cryptoAmount && selectedProviderRate.cryptoAmount > 0
      ? selectedProviderRate.cryptoAmount
      : amountValue;

  // An order that was created but whose funding transfer failed. Retrying the same
  // withdrawal replays this exact request so the backend returns the existing order;
  // any edit starts a fresh withdrawal instead of colliding with it.
  const pendingOrderRef = useRef<{
    identity: string;
    request: { providerName: string; payload: OfframpInitRequest };
    order: OfframpResponse;
  } | null>(null);

  const [termsChange, setTermsChange] = useState<null | {
    transactionId: string;
    quoted: OfframpTermsSide;
    updated: OfframpTermsSide;
    request: { providerName: string; payload: OfframpInitRequest };
  }>(null);
  const [isResolvingTerms, setIsResolvingTerms] = useState(false);
  const termsActionInFlightRef = useRef(false);
  const [requoteNotice, setRequoteNotice] = useState<string | null>(null);
  const [retryAfterAt, setRetryAfterAt] = useState<number | null>(null);
  const [retryCountdown, setRetryCountdown] = useState(0);
  useEffect(() => {
    if (!retryAfterAt) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((retryAfterAt - Date.now()) / 1000));
      setRetryCountdown(left);
      if (left === 0) setRetryAfterAt(null);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [retryAfterAt]);

  const goBack = () => {
    if (step === "amount") setStep("asset");
    else if (step === "bank") setStep("amount");
    else if (step === "review") setStep("bank");
    else onAttemptClose(false);
  };

  const initiateWithdrawal = async (
    verification?: {
      verificationCode: string;
      verificationType: VerificationType;
      verificationMethod: VerificationMethod;
    },
    retryRequest?: {
      providerName: string;
      payload: OfframpInitRequest;
    },
    retryOrder?: OfframpResponse,
  ) => {
    if (
      withdrawalInFlightRef.current ||
      (retryAfterAt && Date.now() < retryAfterAt)
    )
      return;
    if (
      !selectedProvider ||
      !selectedBank ||
      !asset ||
      !networkName ||
      !amountValue ||
      (!hasSelectedProviderRate &&
        !retryOrder &&
        !pendingOrderRef.current?.order)
    ) {
      if (!hasSelectedProviderRate) {
        toast.error(
          "Rate unavailable. Please select a provider with an active rate.",
        );
      }
      return;
    }

    const selectedNetworkKey = selectedAssetDetails?.network.key || networkName;

    withdrawalInFlightRef.current = true;
    setRequoteNotice(null);
    setIsSubmitting(true);
    const identity = JSON.stringify([
      normalizeProviderKey(selectedProvider.name),
      asset,
      selectedNetworkKey,
      amountValue,
      fiatCurrency,
      selectedBank.id,
    ]);
    const pendingOrder =
      pendingOrderRef.current?.identity === identity
        ? pendingOrderRef.current
        : null;
    if (!pendingOrder) pendingOrderRef.current = null;

    // Resume only the MFA round trip or a retry of the same pending order.
    const operationKey = beginOperation(
      Boolean(verification) ||
        Boolean(retryRequest) ||
        Boolean(retryOrder) ||
        Boolean(pendingOrder),
    );
    let request = retryRequest ?? pendingOrder?.request;
    let createdOrder = retryOrder ?? pendingOrder?.order ?? null;

    try {
      const chainBlocked = chainStatus.blockedMessage(networkName, "out");
      if (chainBlocked) throw new Error(chainBlocked);
      if (!request) {
        if (
          !selectedProviderRate?.quoteId ||
          !Number.isFinite(Date.parse(selectedProviderRate.expiresAt || "")) ||
          Date.parse(selectedProviderRate.expiresAt || "") <= Date.now()
        ) {
          setStep("provider");
          refreshQuotes();
          throw new Error(
            "Your withdrawal quote expired. Review the refreshed payout before confirming.",
          );
        }
        const providerName = normalizeProviderKey(selectedProvider.name);
        const rate = selectedProviderRawRate
          ? String(selectedProviderRawRate)
          : undefined;
        // Keyed to the operation, not the clock — Date.now() breaks the body hash on retry.
        const providerReference =
          providerName === "paycrest" ? `paycrest-${operationKey}` : undefined;

        request = {
          providerName,
          payload: {
            quoteId: selectedProviderRate.quoteId,
            fiatCurrency,
            fiatAmount: estimatedFiatAmount,
            cryptoAmount: withdrawalCryptoAmount,
            amount: withdrawalCryptoAmount,
            cryptoCurrency: asset,
            cryptoCurrencyCode: asset,
            cryptocurrency: asset,
            asset,
            token: providerName === "paycrest" ? asset : undefined,
            // Backend balance records use canonical keys (for example `bnb`),
            // while networkName is the user-facing label (`BNB`).
            chain: selectedNetworkKey,
            network: selectedNetworkKey,
            rate,
            reference: providerReference,
            narration: providerName === "paycrest" ? "Withdrawal" : undefined,
            description: providerName === "paycrest" ? "Withdrawal" : undefined,
            receiveAmount: estimatedFiatAmount,
            receiveCurrency: fiatCurrency,
            estimatedFiatAmount,
            country: payoutCountry,
            bankId: selectedBank.id,
            bankAccountId: selectedBank.id,
            bankDetail: {
              id: selectedBank.id,
              bankName: selectedBank.bankName,
              accountNumber: selectedBank.accountNumber,
              accountName: selectedBank.accountName,
              bankCode: selectedBank.bankCode || undefined,
            },
          },
        };
      }

      const { providerName } = request;
      const payload: OfframpInitRequest = {
        ...request.payload,
        verificationCode: verification?.verificationCode,
        verificationType: verification?.verificationType,
      };

      createdOrder = await getOrCreateOfframpOrder(createdOrder, async () => {
        if (providerName === "moneygram") {
          return (await offrampService.initiateMoneyGram(payload)).data;
        }
        if (providerName === "paychant") {
          return (await offrampService.initiatePaychant(payload)).data;
        }
        if (providerName === "paycrest") {
          return (await offrampService.initiatePaycrest(payload)).data;
        }
        if (providerName === "centiiv") {
          return (await offrampService.initiateCentiiv(payload)).data;
        }
        if (providerName === "transak") {
          return (await offrampService.initiateTransak(payload)).data;
        }
        if (providerName === "moonpay") {
          return (await offrampService.initiateMoonpay(payload)).data;
        }
        if (providerName === "quidax") {
          return (await offrampService.initiateQuidax(payload)).data;
        }
        if (providerName === "ramphub") {
          return (await offrampService.initiateRamphub(payload)).data;
        }
        return (await offrampService.initiateRamp(payload)).data;
      });

      const redirectUrl =
        createdOrder.checkoutUrl ||
        createdOrder.paymentUrl ||
        createdOrder.redirectUrl ||
        createdOrder.url;

      if (redirectUrl) {
        toast.success("Withdrawal initialized. Redirecting...");
        window.location.assign(redirectUrl);
        return;
      }

      const transactionId = getOfframpTransactionReference(createdOrder);
      pendingOrderRef.current = { identity, request, order: createdOrder };

      // The ledger is already debited but the tokens haven't moved; don't report success yet.
      const pendingDeposit = getPendingDeposit(createdOrder);
      // On a retry, a funding transfer that already reached the bundler must not be paid twice.
      const alreadyFunded =
        pendingOrder && transactionId
          ? await transactionService
              .getTransaction(transactionId)
              .then((res) =>
                Boolean(
                  (
                    res.data as
                      | { metadata?: Record<string, unknown> }
                      | undefined
                  )?.metadata?.fundingTxHash,
                ),
              )
              .catch(() => false)
          : false;
      if (pendingDeposit && !alreadyFunded) {
        toast.info("Order created. Confirm the transfer to complete it.");

        await fundOfframpOrder({
          order: createdOrder,
          chainKey: selectedNetworkKey,
          symbol: asset,
          verification: verification
            ? {
                type: verification.verificationMethod,
                code: verification.verificationCode,
              }
            : undefined,
        });
      }

      setVerificationRequest(null);
      setVerificationError(null);
      pendingOrderRef.current = null;
      endOperation();
      toast.success(createdOrder.message || "Withdrawal initialized");

      if (transactionId) {
        router.replace(getTransactionDetailsPath(transactionId, "flow"));
      }
    } catch (error) {
      const isVerifying = Boolean(verification?.verificationCode);

      if (error instanceof OfframpVerificationRequiredError) {
        if (!request) {
          toast.error("Unable to preserve the withdrawal for verification.");
          return;
        }

        let userEnabledMethods: VerificationMethod[] | null = null;
        try {
          const settings = await securityService.getSettings();
          userEnabledMethods = getEnabledTransactionVerificationMethods(settings);
        } catch {
          userEnabledMethods = null;
        }
        const hasNoSecurityMethods =
          userEnabledMethods !== null && userEnabledMethods.length === 0;

        const availableMethods = getAvailableVerificationMethods(
          error.availableMethods,
          error.verificationType,
        );
        const verificationMethod = resolveVerificationMethod(
          availableMethods,
          userEnabledMethods?.includes("totp")
            ? "totp"
            : error.verificationType,
        );
        setVerificationRequest({
          verificationType: getVerificationTypeForMethod(verificationMethod),
          verificationMethod,
          availableMethods: hasNoSecurityMethods ? [] : availableMethods,
          otpSent: hasNoSecurityMethods ? false : isVerifying ? true : verificationMethod !== "totp",
          action: "withdrawal",
          request,
        });

        if (isVerifying) {
          const msg = "Invalid verification code. Please try again.";
          setVerificationError(msg);
          toast.error(msg);
        } else {
          setVerificationError(null);
          if (!hasNoSecurityMethods) {
            toast.info(
              verificationMethod === "sms_otp"
                ? "We sent a verification code to your phone. Enter it to continue."
                : verificationMethod === "totp"
                  ? "Enter your authenticator code to continue."
                  : "We sent a verification code to your email. Enter it to continue.",
            );
          }
        }
        return;
      }

      const verificationError = findTransferVerificationRequiredError(error);
      if (verificationError) {
        let userEnabledMethods: VerificationMethod[] | null = null;
        try {
          const settings = await securityService.getSettings();
          userEnabledMethods = getEnabledTransactionVerificationMethods(settings);
        } catch {
          userEnabledMethods = null;
        }
        const hasNoSecurityMethods =
          userEnabledMethods !== null && userEnabledMethods.length === 0;

        const availableMethods = getAvailableVerificationMethods(
          verificationError.availableMethods,
          verificationError.verificationType,
        );
        const verificationMethod = resolveVerificationMethod(
          availableMethods,
          userEnabledMethods?.includes("totp")
            ? "totp"
            : verificationError.verificationType,
        );
        setVerificationRequest({
          verificationType: getVerificationTypeForMethod(verificationMethod),
          verificationMethod,
          availableMethods: hasNoSecurityMethods ? [] : availableMethods,
          otpSent: hasNoSecurityMethods ? false : isVerifying ? true : verificationMethod !== "totp",
          action: verificationError.action || "withdrawal",
          request,
          order: createdOrder ?? undefined,
        });

        if (isVerifying) {
          const msg = "Invalid verification code. Please try again.";
          setVerificationError(msg);
          toast.error(msg);
        } else {
          setVerificationError(null);
          if (!hasNoSecurityMethods) {
            toast.info(
              verificationMethod === "sms_otp"
                ? "We sent a verification code to your phone. Enter it to continue."
                : verificationMethod === "totp"
                  ? "Enter your authenticator code to continue."
                  : "We sent a verification code to your email. Enter it to continue.",
            );
          }
        }
        return;
      }

      if (!createdOrder && error instanceof OfframpApiError) {
        const body = error.body;
        if (
          error.code === "OFFRAMP_TERMS_CHANGED" &&
          typeof body.transactionId === "string" &&
          request &&
          body.quoted &&
          body.updated
        ) {
          pendingOrderRef.current = null;
          setVerificationRequest(null);
          endOperation();
          setTermsChange({
            transactionId: body.transactionId,
            quoted: body.quoted as OfframpTermsSide,
            updated: body.updated as OfframpTermsSide,
            request,
          });
          return;
        }
        if (error.code === "OFFRAMP_REQUOTE_REQUIRED") {
          pendingOrderRef.current = null;
          setVerificationRequest(null);
          endOperation();
          const fresh = body.requote as
            | {
                quoteId?: string;
                expiresAt?: string;
                maxCryptoDebit?: string;
                netFiat?: string;
                rate?: string;
              }
            | undefined;
          if (
            fresh?.quoteId &&
            fresh.expiresAt &&
            Number(fresh.netFiat) > 0 &&
            selectedProviderId
          ) {
            applyQuote(selectedProviderId, {
              quoteId: fresh.quoteId,
              expiresAt: fresh.expiresAt,
              maxCryptoDebit: fresh.maxCryptoDebit,
              fiatAmount: Number(fresh.netFiat),
              ...(Number(fresh.rate) > 0
                ? { rawRate: Number(fresh.rate) }
                : {}),
            });
          } else {
            setStep("provider");
            refreshQuotes();
          }
          setRequoteNotice(
            "The rate moved while you were confirming. Review the updated amount and confirm again.",
          );
          return;
        }
        if (error.code === "OFFRAMP_DUPLICATE_WAIT") {
          pendingOrderRef.current = null;
          setVerificationRequest(null);
          endOperation();
          const seconds = Number(body.retryAfterSeconds);
          setRetryAfterAt(
            Date.now() +
              (Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000,
          );
          return;
        }
      }

      // Keep the key when an order exists so the retry replays it instead of duplicating.
      if (!createdOrder) {
        pendingOrderRef.current = null;
        endOperation();
        setStep("provider");
        refreshQuotes();
      }

      const message =
        error instanceof Error
          ? error.message
          : "Unable to initialize withdrawal";

      toast.error(
        createdOrder
          ? `${message}. Your withdrawal order is still open — retry to complete the transfer.`
          : message,
      );
    } finally {
      withdrawalInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  const acceptChangedTerms = async () => {
    if (!termsChange || termsActionInFlightRef.current) return;
    const change = termsChange;
    termsActionInFlightRef.current = true;
    setIsResolvingTerms(true);
    try {
      const response = await offrampService.acceptTerms(change.transactionId);
      setTermsChange(null);
      // Reuse main's existing order-funding and MFA retry path, not a new initiation.
      await initiateWithdrawal(undefined, change.request, response.data);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not accept the updated amount. Please try again.",
      );
    } finally {
      termsActionInFlightRef.current = false;
      setIsResolvingTerms(false);
    }
  };

  const declineChangedTerms = async () => {
    if (!termsChange || termsActionInFlightRef.current) return;
    termsActionInFlightRef.current = true;
    setIsResolvingTerms(true);
    try {
      await offrampService.declineTerms(termsChange.transactionId);
      setTermsChange(null);
      endOperation();
      setStep("provider");
      refreshQuotes();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not cancel the updated withdrawal. Please try again.",
      );
    } finally {
      termsActionInFlightRef.current = false;
      setIsResolvingTerms(false);
    }
  };

  const submitWithdrawalVerification = (
    verificationCode: string,
    methodOverride?: VerificationMethod,
  ) => {
    if (!verificationRequest) return;
    const pendingVerification = verificationRequest;
    const effectiveMethod =
      methodOverride || pendingVerification.verificationMethod;
    setVerificationError(null);
    void initiateWithdrawal(
      {
        verificationCode,
        verificationType: getVerificationTypeForMethod(effectiveMethod),
        verificationMethod: effectiveMethod,
      },
      pendingVerification.request,
      pendingVerification.order,
    );
  };

  const closeWithdrawalVerification = () => {
    if (isSubmitting) return;
    setVerificationRequest(null);
    setVerificationError(null);
  };

  const prepareWithdrawalVerification = async () => {
    if (
      isSubmitting ||
      withdrawalInFlightRef.current ||
      termsChange ||
      termsActionInFlightRef.current ||
      (retryAfterAt && Date.now() < retryAfterAt)
    )
      return;

    setIsSubmitting(true);
    try {
      const securitySettings = await securityService.getSettings();
      const availableMethods =
        getEnabledTransactionVerificationMethods(securitySettings);

      if (!availableMethods.length) {
        setVerificationRequest({
          verificationType: "totp",
          verificationMethod: "totp",
          availableMethods: [],
          otpSent: false,
          action: "withdrawal",
        });
        return;
      }

      const verificationMethod = availableMethods[0];
      setVerificationRequest({
        verificationType: getVerificationTypeForMethod(verificationMethod),
        verificationMethod,
        availableMethods,
        // TOTP is immediately available. OTP channels wait for an explicit user request.
        otpSent: verificationMethod === "totp",
        action: "withdrawal",
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to load your verification methods",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestWithdrawalOtp = async (method: VerificationMethod) => {
    const channel = getOtpChannelForMethod(method);
    if (!verificationRequest || !channel || isResendingVerification) return;

    setIsResendingVerification(true);
    try {
      const response = await transferService.requestOTP(
        verificationRequest.action || "withdrawal",
        channel,
      );
      setVerificationRequest((current) =>
        current?.verificationMethod === method
          ? { ...current, otpSent: true }
          : current,
      );
      toast.success(
        response.message ||
          `Verification code sent by ${channel === "sms" ? "SMS" : "email"}.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to send verification code",
      );
    } finally {
      setIsResendingVerification(false);
    }
  };

  const selectWithdrawalVerificationMethod = (method: VerificationMethod) => {
    if (
      !verificationRequest ||
      method === verificationRequest.verificationMethod
    )
      return;

    setVerificationRequest((current) =>
      current
        ? {
            ...current,
            verificationMethod: method,
            verificationType: getVerificationTypeForMethod(method),
            otpSent: method === "totp",
          }
        : current,
    );
  };

  const hasStarted = Boolean(asset || amount || providerId || bankId);

  return (
    <>
      <div className="container mx-auto flex min-h-[100dvh] max-w-2xl flex-col pb-[env(safe-area-inset-bottom)] md:min-h-[90dvh] md:pb-32 md:pt-20">
        <FlowHeader
          title={
            step === "amount"
              ? "Enter Amount"
              : step === "bank"
                ? selectedProvider?.name?.toLowerCase() === "paycrest"
                  ? "Payout Account"
                  : "Select Bank"
                : step === "review"
                  ? "Review Withdrawal"
                  : "Withdraw"
          }
          onBack={goBack}
          onClose={() =>
            hasStarted ? setShowExitModal(true) : onAttemptClose(false)
          }
          closeLabel="Close withdrawal flow"
          className="mb-4 px-3 pt-2 sm:mb-8 sm:px-4 sm:pt-4"
        />

        <StepIndicator
          currentStep={WITHDRAW_STEPS.indexOf(step)}
          totalSteps={WITHDRAW_STEPS.length}
        />

        <div
          className={`mx-auto flex w-full max-w-md flex-1 flex-col px-3 sm:px-4 md:w-lg md:max-w-2xl md:px-0 ${
            step === "asset" ? "pt-4" : "pt-1"
          }`}
        >
          {step === "asset" ? (
            <WithdrawAssetSelectionStep
              asset={asset}
              networkId={networkId}
              country={country}
              isDetectingCountry={isDetectingCountry}
              assets={withdrawableAssets}
              onSelectAssetGroup={setAsset}
              onSelectAsset={(nextAsset) => {
                setAssetAndNetwork(
                  nextAsset.symbol,
                  nextAsset.network.name,
                  nextAsset.network.id,
                );
              }}
              onOpenCountryModal={() => setIsCountryModalOpen(true)}
              onBackToWallet={() => onAttemptClose(false)}
              onContinue={() => setStep("amount")}
            />
          ) : null}

          {step === "amount" ? (
            <WithdrawAmountEntryStep
              asset={asset}
              selectedChain={selectedChain}
              amount={amount}
              assetBalance={selectedAssetBalance}
              country={payoutCountry}
              fiatCurrency={fiatCurrency}
              isDetectingCountry={isDetectingCountry}
              providers={providers}
              selectedProviderId={selectedProviderId}
              onSelectProvider={(id) => {
                userManuallySelectedRef.current = true;
                setSelectedProviderId(id);
                setProviderId(id);
              }}
              providerRates={providerRates}
              isRatesLoading={isLoadingRates}
              onContinue={() => {
                if (isAmountValid) {
                  if (!hasSelectedProviderRate && selectedProvider) {
                    toast.error(
                      "Rate unavailable. Please select another provider or try again.",
                    );
                    return;
                  }
                  setStep("bank");
                }
              }}
              onAmountChange={setAmount}
              onBridge={() => {
                if (!asset || !selectedAssetDetails) return;
                setBridgeRequest({
                  symbol: asset,
                  targetChain: selectedAssetDetails.network.name,
                  requiredAmount: amountValue,
                  targetBalance: selectedAssetBalance,
                });
              }}
            />
          ) : null}

          {step === "bank" ? (
            <WithdrawBankSelectionStep
              asset={asset}
              amount={amount}
              amountUnit={asset}
              fiatCurrency={fiatCurrency}
              fiatAmount={
                estimatedFiatAmount > 0
                  ? formatNumberWithCommas(estimatedFiatAmount.toFixed(2))
                  : undefined
              }
              country={payoutCountry}
              selectedChain={selectedChain}
              selectedBank={selectedBank}
              savedBanks={savedBanks}
              providerName={selectedProvider?.name || null}
              routeProvider={selectedProviderRate?.routeProvider || null}
              selectedProviderBank={selectedProviderBank}
              onSelectSavedBank={(bank) => setBankId(bank.id)}
              onSelectProviderBank={setSelectedProviderBank}
              onOpenBankModal={() => setIsBankModalOpen(true)}
              onAddVerifiedBank={(bank) => {
                setSavedBanks((currentBanks) => {
                  const exists = currentBanks.some(
                    (currentBank) => currentBank.id === bank.id,
                  );
                  return exists ? currentBanks : [bank, ...currentBanks];
                });
                setBankId(bank.id);
              }}
              onContinue={() => selectedBank && setStep("review")}
            />
          ) : null}

          {requoteNotice ? (
            <p
              role="status"
              className="mb-3 rounded-xl bg-primary/10 p-3 text-sm text-black dark:text-white"
            >
              {requoteNotice}
            </p>
          ) : null}
          {step === "review" && retryCountdown > 0 ? (
            <p
              role="status"
              className="mb-3 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300"
            >
              Finishing your previous attempt. You can confirm again in{" "}
              {retryCountdown}s.
            </p>
          ) : null}
          {step === "review" ? (
            <WithdrawReviewStep
              netFiat={estimatedFiatAmount}
              fiatCurrency={fiatCurrency}
              maxCryptoDebit={selectedProviderRate?.maxCryptoDebit}
              amount={amount}
              asset={asset}
              amountUnit=""
              selectedChain={selectedChain}
              selectedProvider={selectedProvider}
              selectedBank={selectedBank}
              exchangeRate={selectedProviderRawRate}
              fee={selectedProviderRate?.fee}
              feeCurrency={selectedProviderRate?.feeCurrency}
              isSubmitting={
                isSubmitting ||
                retryCountdown > 0 ||
                Boolean(termsChange) ||
                isResolvingTerms
              }
              paymentRail={ACTIVE_PAYMENT_RAIL}
              onConfirm={prepareWithdrawalVerification}
            />
          ) : null}
        </div>
      </div>

      <CountrySelectorModal
        isVisible={isCountryModalOpen}
        onClose={() => setIsCountryModalOpen(false)}
        selectedCountry={country || "NG"}
        countries={SUPPORTED_RAMP_COUNTRIES}
        onSelect={(code) =>
          setCountryAndCurrency(code, getCurrencyForCountry(code), "manual")
        }
      />

      <SelectBankModal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        currency={fiatCurrency}
        providerName={selectedProvider?.name || null}
        routeProvider={selectedProviderRate?.routeProvider || null}
        selectedBankCode={
          selectedProviderBank?.value || selectedBank?.bankCode || null
        }
        onSelectBank={setSelectedProviderBank}
      />

      <ExitConfirmation
        isOpen={showExitModal}
        onStay={() => setShowExitModal(false)}
        onLeave={() => onAttemptClose(true)}
        title="Cancel this withdrawal?"
        description="Your withdrawal details have not been submitted and will be discarded."
        stayLabel="Continue withdrawal"
        leaveLabel="Cancel withdrawal"
      />

      <Dialog
        open={Boolean(termsChange)}
        onOpenChange={(open) => {
          if (!open && !isResolvingTerms) void declineChangedTerms();
        }}
      >
        <DialogContent
          className="bg-gray-90 bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 dark:bg-secondary dark:bg-none"
          showCloseButton={!isResolvingTerms}
        >
          <DialogHeader>
            <DialogTitle>Rate updated</DialogTitle>
            <DialogDescription>
              The provider&apos;s final amount changed while your withdrawal was
              being set up. Review the new amount before continuing.
            </DialogDescription>
          </DialogHeader>
          {termsChange ? (
            <div className="space-y-3 rounded-xl bg-white p-4 text-sm dark:bg-secondary-60">
              <div className="flex justify-between gap-4">
                <span>You receive</span>
                <span className="text-right font-semibold">
                  {Number(termsChange.updated.payout).toLocaleString(
                    undefined,
                    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                  )}{" "}
                  {termsChange.updated.currency}
                  <span className="ml-2 text-xs text-slate-500 line-through">
                    {Number(termsChange.quoted.payout).toLocaleString(
                      undefined,
                      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                    )}{" "}
                    {termsChange.quoted.currency}
                  </span>
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>You send</span>
                <span className="text-right font-semibold">
                  {termsChange.updated.debit} {asset}
                  {termsChange.updated.debit !== termsChange.quoted.debit ? (
                    <span className="ml-2 text-xs text-slate-500 line-through">
                      {termsChange.quoted.debit} {asset}
                    </span>
                  ) : null}
                </span>
              </div>
            </div>
          ) : null}
          <DialogFooter className="grid grid-cols-1 sm:grid-cols-2">
            <Button
              variant="ghost"
              disabled={isResolvingTerms}
              onClick={() => void declineChangedTerms()}
            >
              Cancel withdrawal
            </Button>
            <Button
              disabled={isResolvingTerms}
              onClick={() => void acceptChangedTerms()}
            >
              {isResolvingTerms ? "Confirming..." : "Accept new amount"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TransferVerificationModal
        isOpen={Boolean(verificationRequest)}
        isSubmitting={isSubmitting}
        verificationType={verificationRequest?.verificationType || "email_otp"}
        availableMethods={verificationRequest?.availableMethods}
        selectedMethod={verificationRequest?.verificationMethod}
        onMethodChange={selectWithdrawalVerificationMethod}
        otpSent={verificationRequest?.otpSent}
        onResend={() => {
          if (verificationRequest) {
            void requestWithdrawalOtp(verificationRequest.verificationMethod);
          }
        }}
        isResending={isResendingVerification}
        onClose={closeWithdrawalVerification}
        onSubmit={submitWithdrawalVerification}
        title="Confirm withdrawal"
        actionNoun="withdrawal"
        errorMessage={verificationError}
        onClearError={() => setVerificationError(null)}
      />
      <BridgeFundingOverlay
        profile={activeProfile}
        request={bridgeRequest}
        onOpenChange={(open) => !open && setBridgeRequest(null)}
      />
    </>
  );
}
