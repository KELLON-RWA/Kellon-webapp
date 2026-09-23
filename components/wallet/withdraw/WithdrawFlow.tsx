"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BankDetail, User } from "@/types/db";
import { useWithdrawState, WITHDRAW_STEPS } from "@/hooks/use-withdraw-state";
import { useCountryDetection } from "@/hooks/use-country-detection";
import { getCurrencyForCountry } from "@/lib/country-currency-map";
import { getChainById } from "@/lib/chains";
import { ACTIVE_PAYMENT_RAIL } from "@/lib/payment-rails";
import { useProviders } from "@/hooks/use-provider";
import { useProviderRates } from "@/hooks/use-provider-rates";
import { CountrySelectorModal } from "@/components/modals/CountrySelectorModal";
import { SUPPORTED_RAMP_COUNTRIES } from "@/lib/supported-countries";
import { ExitConfirmation } from "@/components/modals/ExitComfirmationModal";
import { bankService } from "@/services/api/bank";
import {
  OfframpVerificationRequiredError,
  offrampService,
  type OfframpInitRequest,
  type OfframpResponse,
} from "@/services/api/off-ramp";
import TransferVerificationModal from "@/components/wallet/send/TransferVerificationModal";
import BridgeFundingOverlay, {
  type BridgeFundingRequest,
} from "@/components/wallet/bridge/BridgeFundingOverlay";
import FlowHeader from "@/components/wallet/shared/FlowHeader";
import StepIndicator from "@/components/wallet/shared/FlowStepIndicator";
import { WithdrawAssetSelectionStep } from "./steps/AssetSelectionStep";
import { WithdrawAmountEntryStep } from "./steps/AmountEntryStep";
import { WithdrawProviderSelectionStep } from "./steps/ProviderSelectionStep";
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
import {
  beginOperation,
  endOperation,
} from "@/services/api";
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
    if (providerId && providerId !== selectedProviderId) {
      setSelectedProviderId(providerId);
    }
  }, [providerId, selectedProviderId, setSelectedProviderId]);

  useEffect(() => {
    if (selectedProviderId && selectedProviderId !== providerId) {
      setProviderId(selectedProviderId);
    }
  }, [providerId, selectedProviderId, setProviderId]);

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
    amountValue > 0 &&
    amountValue <= selectedAssetBalance;
  const { rates: providerRates, isLoadingRates } = useProviderRates({
    providers,
    asset,
    amount: amountValue,
    currency: fiatCurrency,
    networkName,
    isAmountValid,
    isLoadingProviders,
    side: "sell",
  });
  const selectedProviderRate = selectedProviderId
    ? providerRates[selectedProviderId]
    : null;
  const selectedProviderRawRate =
    selectedProviderRate?.rawRate && selectedProviderRate.rawRate > 0
      ? selectedProviderRate.rawRate
      : undefined;
  const hasSelectedProviderRate = Boolean(selectedProviderRawRate);
  const estimatedFiatAmount =
    selectedProviderRate?.fiatAmount && selectedProviderRate.fiatAmount > 0
      ? selectedProviderRate.fiatAmount
      : amountValue;
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

  const goBack = () => {
    if (step === "amount") setStep("asset");
    else if (step === "provider") setStep("amount");
    else if (step === "bank") setStep("provider");
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
    if (withdrawalInFlightRef.current) return;
    if (
      !selectedProvider ||
      !selectedBank ||
      !asset ||
      !networkName ||
      !amountValue ||
      !hasSelectedProviderRate
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
      pendingOrderRef.current?.identity === identity ? pendingOrderRef.current : null;
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
      if (!request) {
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
                  (res.data as { metadata?: Record<string, unknown> } | undefined)
                    ?.metadata?.fundingTxHash,
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
          fallbackAmount: withdrawalCryptoAmount,
          verification: verification
            ? {
                type: verification.verificationMethod,
                code: verification.verificationCode,
              }
            : undefined,
        });
      }

      setVerificationRequest(null);
      pendingOrderRef.current = null;
      endOperation();
      toast.success(createdOrder.message || "Withdrawal initialized");

      if (transactionId) {
        router.replace(getTransactionDetailsPath(transactionId, "flow"));
      }
    } catch (error) {
      if (error instanceof OfframpVerificationRequiredError) {
        if (!request) {
          toast.error("Unable to preserve the withdrawal for verification.");
          return;
        }

        const availableMethods = getAvailableVerificationMethods(
          error.availableMethods,
          error.verificationType,
        );
        const verificationMethod = resolveVerificationMethod(
          availableMethods,
          error.verificationType,
        );
        setVerificationRequest({
          verificationType: getVerificationTypeForMethod(verificationMethod),
          verificationMethod,
          availableMethods,
          otpSent: verificationMethod !== "totp",
          action: "withdrawal",
          request,
        });
        toast.info(
          verificationMethod === "sms_otp"
            ? "We sent a verification code to your phone. Enter it to continue."
            : verificationMethod === "totp"
              ? "Enter your authenticator code to continue."
              : "We sent a verification code to your email. Enter it to continue.",
        );
        return;
      }

      const verificationError = findTransferVerificationRequiredError(error);
      if (verificationError) {
        const availableMethods = getAvailableVerificationMethods(
          verificationError.availableMethods,
          verificationError.verificationType,
        );
        const verificationMethod = resolveVerificationMethod(
          availableMethods,
          verificationError.verificationType,
        );
        setVerificationRequest({
          verificationType: getVerificationTypeForMethod(verificationMethod),
          verificationMethod,
          availableMethods,
          otpSent: verificationMethod !== "totp",
          action: verificationError.action || "withdrawal",
          request,
          order: createdOrder ?? undefined,
        });
        toast.info(
          verificationMethod === "sms_otp"
            ? "We sent a verification code to your phone. Enter it to continue."
            : verificationMethod === "totp"
              ? "Enter your authenticator code to continue."
              : "We sent a verification code to your email. Enter it to continue.",
        );
        return;
      }

      // Keep the key when an order exists so the retry replays it instead of duplicating.
      if (!createdOrder) {
        pendingOrderRef.current = null;
        endOperation();
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

  const submitWithdrawalVerification = (verificationCode: string) => {
    if (!verificationRequest) return;
    const pendingVerification = verificationRequest;
    setVerificationRequest(null);
    void initiateWithdrawal(
      {
        verificationCode,
        verificationType: getVerificationTypeForMethod(
          pendingVerification.verificationMethod,
        ),
        verificationMethod: pendingVerification.verificationMethod,
      },
      pendingVerification.request,
      pendingVerification.order,
    );
  };

  const closeWithdrawalVerification = () => {
    if (isSubmitting) return;
    setVerificationRequest(null);
  };

  const prepareWithdrawalVerification = async () => {
    if (isSubmitting || withdrawalInFlightRef.current) return;

    setIsSubmitting(true);
    try {
      const securitySettings = await securityService.getSettings();
      const availableMethods =
        getEnabledTransactionVerificationMethods(securitySettings);

      if (!availableMethods.length) {
        toast.error(
          "Enable email, SMS, or Google Authenticator in Security & Backup before withdrawing.",
        );
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
            step === "provider"
              ? "Choose Provider"
              : step === "amount"
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
          className="mb-8 px-4 pt-4"
        />

        <StepIndicator
          currentStep={WITHDRAW_STEPS.indexOf(step)}
          totalSteps={WITHDRAW_STEPS.length}
        />

        <div
          className={`mx-auto flex w-11/12 flex-1 flex-col md:mx-auto md:w-lg ${
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
              onContinue={() => isAmountValid && setStep("provider")}
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

          {step === "provider" ? (
            <WithdrawProviderSelectionStep
              asset={asset}
              amount={amount}
              amountUnit={asset}
              fiatCurrency={fiatCurrency}
              selectedChain={selectedChain}
              providers={providers}
              selectedProviderId={selectedProviderId || null}
              onSelectProvider={setSelectedProviderId}
              onContinue={() => {
                if (!selectedProviderId) return;
                if (!hasSelectedProviderRate) {
                  toast.error(
                    "Rate unavailable. Please select another provider or try again.",
                  );
                  return;
                }
                setStep("bank");
              }}
              providerRates={providerRates}
              isRatesLoading={isLoadingRates}
              country={country}
              onGoHome={() => router.push("/")}
              onChangeSelection={() => setStep("asset")}
            />
          ) : null}

          {step === "bank" ? (
            <WithdrawBankSelectionStep
              asset={asset}
              amount={amount}
              amountUnit={asset}
              fiatCurrency={fiatCurrency}
              country={payoutCountry}
              selectedChain={selectedChain}
              selectedBank={selectedBank}
              savedBanks={savedBanks}
              providerName={selectedProvider?.name || null}
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

          {step === "review" ? (
            <WithdrawReviewStep
              amount={amount}
              asset={asset}
              amountUnit={asset}
              selectedChain={selectedChain}
              selectedProvider={selectedProvider}
              selectedBank={selectedBank}
              isSubmitting={isSubmitting}
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
        leaveLabel="Cancel withdrawal"
      />

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
      />
      <BridgeFundingOverlay
        profile={activeProfile}
        request={bridgeRequest}
        onOpenChange={(open) => !open && setBridgeRequest(null)}
      />
    </>
  );
}
