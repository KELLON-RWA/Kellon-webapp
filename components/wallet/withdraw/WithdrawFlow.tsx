"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Asset, BankDetail, User } from "@/types/db";
import { useWithdrawState, WITHDRAW_STEPS } from "@/hooks/use-withdraw-state";
import { useCountryDetection } from "@/hooks/use-country-detection";
import { getCurrencyForCountry } from "@/lib/country-currency-map";
import { getChainById, getSupportedChainsForToken } from "@/lib/chains";
import { useProviders } from "@/hooks/use-provider";
import { useProviderRates } from "@/hooks/use-provider-rates";
import { CountrySelectorModal } from "@/components/modals/CountrySelectorModal";
import { SUPPORTED_RAMP_COUNTRIES } from "@/lib/supported-countries";
import { ExitConfirmation } from "@/components/modals/ExitComfirmationModal";
import { bankService } from "@/services/api/bank";
import {
  offrampService,
  type OfframpInitRequest,
  type OfframpResponse,
} from "@/services/api/off-ramp";
import StepIndicator from "@/components/wallet/shared/FlowStepIndicator";
import { WithdrawAssetSelectionStep } from "./steps/AssetSelectionStep";
import { WithdrawAmountEntryStep } from "./steps/AmountEntryStep";
import { WithdrawProviderSelectionStep } from "./steps/ProviderSelectionStep";
import { WithdrawBankSelectionStep } from "./steps/BankSelectionStep";
import { WithdrawReviewStep } from "./steps/ReviewStep";
import SelectBankModal, {
  type SelectableBank,
} from "../../modals/SelectBankModal";

function parseAssetAmount(amount: Asset["amount"]): number {
  const parsed = typeof amount === "string" ? Number(amount) : amount;
  return Number.isFinite(parsed) ? parsed : 0;
}

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

  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [selectedProviderBank, setSelectedProviderBank] =
    useState<SelectableBank | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [savedBanks, setSavedBanks] = useState<BankDetail[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const withdrawableAssets = useMemo(() => {
    const assetMap = new Map<
      string,
      {
        symbol: string;
        name: string;
        balance: number;
        network: { id: string; name: string } | null;
        usdValue: number;
      }
    >();

    (profile.assets || []).forEach((item) => {
      if (!item?.symbol || !item.chain) return;
      const chainName = item.chain.toLowerCase();
      const amount = parseAssetAmount(item.amount);
      if (amount <= 0) return;

      const symbol = item.symbol.toUpperCase();
      if (!["USDC", "USDT"].includes(symbol)) return;
      const current = assetMap.get(symbol) || {
        symbol,
        name:
          symbol === "USDC"
            ? "USD Coin"
            : symbol === "USDT"
              ? "Tether USD"
              : symbol,
        balance: 0,
        network: null,
        usdValue: 0,
      };

      current.balance += amount;
      current.usdValue += amount;

      const supportedChains = getSupportedChainsForToken(
        symbol as "USDC" | "USDT",
      );
      const matchedChain = supportedChains.find(
        (chain) => chain.name.toLowerCase() === chainName,
      );

      if (!current.network) {
        current.network = {
          id: matchedChain?.id ? String(matchedChain.id) : chainName,
          name: chainName,
        };
      }

      assetMap.set(symbol, current);
    });

    return Array.from(assetMap.values());
  }, [profile.assets]);

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
    withdrawableAssets.find((item) => item.symbol === asset) || null;
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

  const goBack = () => {
    if (step === "amount") setStep("asset");
    else if (step === "provider") setStep("amount");
    else if (step === "bank") setStep("provider");
    else if (step === "review") setStep("bank");
    else onAttemptClose(false);
  };

  const initiateWithdrawal = async () => {
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

    setIsSubmitting(true);
    try {
      const providerName = normalizeProviderKey(selectedProvider.name);
      const rate = selectedProviderRawRate
        ? String(selectedProviderRawRate)
        : undefined;
      const providerReference =
        providerName === "paycrest" ? `paycrest-${Date.now()}` : undefined;
      const payload: OfframpInitRequest = {
        fiatCurrency,
        cryptoAmount: withdrawalCryptoAmount,
        cryptoCurrency: asset,
        cryptoCurrencyCode: asset,
        cryptocurrency: asset,
        asset,
        token: providerName === "paycrest" ? asset : undefined,
        chain: networkName,
        network: networkName,
        rate,
        reference: providerReference,
        narration: providerName === "paycrest" ? "Withdrawal" : undefined,
        description: providerName === "paycrest" ? "Withdrawal" : undefined,
        receiveAmount: estimatedFiatAmount,
        receiveCurrency: fiatCurrency,
        estimatedFiatAmount,
        country: payoutCountry,
        bankId: selectedBank.id,
        bankDetail: {
          id: selectedBank.id,
          bankName: selectedBank.bankName,
          accountNumber: selectedBank.accountNumber,
          accountName: selectedBank.accountName,
          bankCode: selectedBank.bankCode || undefined,
        },
      };

      let response;

      if (providerName === "moneygram") {
        response = await offrampService.initiateMoneyGram(payload);
      } else if (providerName === "paychant") {
        response = await offrampService.initiatePaychant(payload);
      } else if (providerName === "paycrest") {
        response = await offrampService.initiatePaycrest(payload);
      } else if (providerName === "centiiv") {
        response = await offrampService.initiateCentiiv(payload);
      } else if (providerName === "transak") {
        response = await offrampService.initiateTransak(payload);
      } else if (providerName === "moonpay") {
        response = await offrampService.initiateMoonpay(payload);
      } else if (providerName === "quidax") {
        response = await offrampService.initiateQuidax(payload);
      } else {
        response = await offrampService.initiateRamp(payload);
      }

      const redirectUrl =
        response.data?.checkoutUrl ||
        response.data?.paymentUrl ||
        response.data?.redirectUrl ||
        response.data?.url;

      if (redirectUrl) {
        toast.success("Withdrawal initialized. Redirecting...");
        window.location.assign(redirectUrl);
        return;
      }

      const transactionId = getOfframpTransactionReference(response.data);

      toast.success(response.data?.message || "Withdrawal initialized");

      if (transactionId) {
        router.push(`/transactions/${transactionId}`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to initialize withdrawal",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasStarted = Boolean(asset || amount || providerId || bankId);

  return (
    <>
      <div className="container mx-auto flex min-h-[90dvh] max-w-2xl flex-col pb-32 md:pt-20">
        <div className="mb-8 flex items-center justify-between px-4 pt-4">
          <button
            type="button"
            onClick={goBack}
            className="rounded-full border border-slate-200 bg-gray-100 p-2 dark:border-none dark:bg-secondary-60/50 cursor-pointer"
          >
            <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-white" />
          </button>
          <h2 className="text-lg font-bold text-black dark:text-white">
            {step === "provider"
              ? "Choose Provider"
              : step === "amount"
                ? "Enter Amount"
                : step === "bank"
                  ? selectedProvider?.name?.toLowerCase() === "paycrest"
                    ? "Payout Account"
                    : "Select Bank"
                  : step === "review"
                    ? "Review Withdrawal"
                    : "Withdraw"}
          </h2>
          <button
            type="button"
            onClick={() =>
              hasStarted ? setShowExitModal(true) : onAttemptClose(false)
            }
            className="rounded-full border border-slate-200 bg-gray-100 p-2 dark:border-none dark:bg-secondary-60/50 cursor-pointer"
          >
            <X className="h-5 w-5 text-slate-600 dark:text-white" />
          </button>
        </div>

        <StepIndicator
          currentStep={WITHDRAW_STEPS.indexOf(step)}
          totalSteps={WITHDRAW_STEPS.length}
        />

        <div className="mx-auto flex w-11/12 flex-1 flex-col pt-4 md:mx-auto md:w-lg">
          {step === "asset" ? (
            <WithdrawAssetSelectionStep
              asset={asset}
              country={country}
              isDetectingCountry={isDetectingCountry}
              assets={withdrawableAssets}
              onSelectAsset={(nextAsset) => {
                const matchedAsset = withdrawableAssets.find(
                  (item) => item.symbol === nextAsset,
                );
                if (matchedAsset?.network) {
                  setAssetAndNetwork(
                    nextAsset,
                    matchedAsset.network.name,
                    matchedAsset.network.id,
                  );
                  return;
                }
                setAsset(nextAsset);
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
              onConfirm={initiateWithdrawal}
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
      />
    </>
  );
}
