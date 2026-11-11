"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  ChevronDown,
  ChevronRight,
  Landmark,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumberWithCommas } from "@/lib/format-number-with-comma";
import {
  isStablecoinAmountWithinBalance,
  MIN_STABLECOIN_AMOUNT,
} from "@/lib/stablecoin-amounts";
import SummaryPill from "@/components/wallet/shared/FlowSummaryPill";
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter";
import BridgeDeficitButton from "@/components/wallet/bridge/BridgeDeficitButton";
import Keypad from "@/components/Keypad";
import { Input } from "@/components/ui/input";
import {
  getBestRateProviderId,
  sortProvidersByRate,
} from "@/lib/provider-rate-display";
import {
  SelectProviderModal,
  type FlowProvider,
  type ProviderRateDetails,
} from "@/components/modals/SelectProviderModal";
import { ProviderLogo } from "@/components/wallet/shared/ProviderLogo";
import { ProviderSelectorTrigger } from "@/components/wallet/shared/ProviderSelectorTrigger";
import { useExchangeRate } from "@/hooks/use-exchange-rate";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

interface AmountEntryStepProps {
  asset: string | null;
  selectedChain?: { name: string } | null;
  amount: string;
  assetBalance: number;
  country?: string | null;
  fiatCurrency?: string;
  isDetectingCountry?: boolean;
  providers?: FlowProvider[];
  selectedProviderId?: string | null;
  onSelectProvider?: (id: string) => void;
  providerRates?: Record<string, ProviderRateDetails | null>;
  isRatesLoading?: boolean;
  onContinue: () => void;
  onAmountChange: (value: string) => void;
  onBridge: () => void;
}

const QUICK_PERCENTAGES = [25, 50, 75, 100] as const;

function formatAssetAmount(value: number) {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(6).replace(/\.?0+$/, "");
}

function getAssetIconUrl(asset: string) {
  return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${asset.toLowerCase()}.png`;
}

export function WithdrawAmountEntryStep({
  asset,
  selectedChain,
  amount,
  assetBalance,
  fiatCurrency = "USD",
  providers = [],
  selectedProviderId = null,
  onSelectProvider,
  providerRates = {},
  isRatesLoading = false,
  onContinue,
  onAmountChange,
  onBridge,
}: AmountEntryStepProps) {
  const [currencyMode, setCurrencyMode] = useState<"crypto" | "fiat">("fiat");
  const [cryptoInput, setCryptoInput] = useState<string>(amount || "");
  const [fiatInput, setFiatInput] = useState<string>("");
  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(
    null,
  );
  const [isAmountEditorOpen, setIsAmountEditorOpen] = useState(false);
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);

  const { exchangeRate } = useExchangeRate(fiatCurrency, asset, {
    preferProviderRate: true,
  });

  const sortedProviders = useMemo(() => {
    return sortProvidersByRate(providers, providerRates, "withdraw");
  }, [providers, providerRates]);

  const bestRateProviderId = useMemo(() => {
    return getBestRateProviderId(providers, providerRates, "withdraw");
  }, [providers, providerRates]);

  const selectedProvider =
    sortedProviders.find((p) => p.id === selectedProviderId) ||
    sortedProviders[0] ||
    null;
  const isBestRate = Boolean(
    selectedProvider && selectedProvider.id === bestRateProviderId,
  );
  const selectedProviderRate = selectedProvider
    ? providerRates[selectedProvider.id]
    : null;

  const effectiveRate = useMemo(() => {
    if (selectedProviderRate?.rawRate && selectedProviderRate.rawRate > 0) {
      return selectedProviderRate.rawRate;
    }
    if (exchangeRate > 0) {
      return exchangeRate;
    }
    return 0;
  }, [selectedProviderRate, exchangeRate]);

  // Sync state if amount changes from parent
  useEffect(() => {
    if (amount !== cryptoInput) {
      setCryptoInput(amount);
      if (effectiveRate > 0 && Number(amount) > 0) {
        setFiatInput((Number(amount) * effectiveRate).toFixed(2));
      } else if (!amount) {
        setFiatInput("");
      }
    }
  }, [amount, effectiveRate, cryptoInput]);

  // If rate becomes available and fiatInput is empty, populate from cryptoInput
  useEffect(() => {
    if (effectiveRate > 0 && cryptoInput && !fiatInput) {
      const num = Number(cryptoInput);
      if (num > 0) {
        setFiatInput((num * effectiveRate).toFixed(2));
      }
    }
  }, [effectiveRate, cryptoInput, fiatInput]);

  const currentCryptoNum = useMemo(() => {
    if (selectedPercentage === 100) {
      return assetBalance;
    }
    const cryptoFromInput = Number(cryptoInput) || 0;
    if (cryptoFromInput > 0) {
      if (
        assetBalance > 0 &&
        cryptoFromInput > assetBalance &&
        cryptoFromInput - assetBalance < 0.000005
      ) {
        return assetBalance;
      }
      return cryptoFromInput;
    }
    if (Number(fiatInput) > 0 && effectiveRate > 0) {
      const raw = Number(fiatInput) / effectiveRate;
      if (
        assetBalance > 0 &&
        raw > assetBalance &&
        raw - assetBalance < 0.000005
      ) {
        return assetBalance;
      }
      return raw;
    }
    return 0;
  }, [selectedPercentage, assetBalance, cryptoInput, fiatInput, effectiveRate]);

  const isOverBalance =
    Number.isFinite(currentCryptoNum) &&
    currentCryptoNum > 0 &&
    !isStablecoinAmountWithinBalance(currentCryptoNum, assetBalance);

  const isAmountValid =
    Number.isFinite(currentCryptoNum) &&
    currentCryptoNum >= MIN_STABLECOIN_AMOUNT &&
    isStablecoinAmountWithinBalance(currentCryptoNum, assetBalance);

  const handleKeypadPress = (val: string) => {
    setSelectedPercentage(null);

    if (currencyMode === "fiat") {
      let nextFiat = fiatInput;
      if (val === "clear") {
        nextFiat = "";
      } else if (val === "delete") {
        nextFiat = fiatInput.slice(0, -1);
      } else if (val === ".") {
        if (fiatInput.includes(".")) return;
        nextFiat = fiatInput ? `${fiatInput}.` : "0.";
      } else if (fiatInput === "0" && val !== ".") {
        nextFiat = val;
      } else {
        const parts = fiatInput.split(".");
        if (parts[1] && parts[1].length >= 2) return;
        nextFiat = fiatInput + val;
      }
      setFiatInput(nextFiat);

      if (nextFiat && Number(nextFiat) > 0 && effectiveRate > 0) {
        let c = Number(nextFiat) / effectiveRate;
        if (
          assetBalance > 0 &&
          c > assetBalance &&
          c - assetBalance < 0.000005
        ) {
          c = assetBalance;
        }
        const cStr = formatAssetAmount(c);
        setCryptoInput(cStr);
        onAmountChange(cStr);
      } else {
        setCryptoInput("");
        onAmountChange("");
      }
    } else {
      let nextCrypto = cryptoInput;
      if (val === "clear") {
        nextCrypto = "";
      } else if (val === "delete") {
        nextCrypto = cryptoInput.slice(0, -1);
      } else if (val === ".") {
        if (cryptoInput.includes(".")) return;
        nextCrypto = cryptoInput ? `${cryptoInput}.` : "0.";
      } else if (cryptoInput === "0" && val !== ".") {
        nextCrypto = val;
      } else {
        const parts = cryptoInput.split(".");
        if (parts[1] && parts[1].length >= 6) return;
        nextCrypto = cryptoInput + val;
      }
      setCryptoInput(nextCrypto);
      onAmountChange(nextCrypto);

      if (nextCrypto && Number(nextCrypto) > 0 && effectiveRate > 0) {
        const f = (Number(nextCrypto) * effectiveRate).toFixed(2);
        setFiatInput(f);
      } else {
        setFiatInput("");
      }
    }
  };

  const handleDesktopInputChange = (rawValue: string) => {
    setSelectedPercentage(null);

    if (!rawValue) {
      setCryptoInput("");
      setFiatInput("");
      onAmountChange("");
      return;
    }

    const sanitized = rawValue.replace(/,/g, "");
    if (!/^\d*\.?\d*$/.test(sanitized)) {
      return;
    }

    if (currencyMode === "fiat") {
      const parts = sanitized.split(".");
      if (parts[1] && parts[1].length > 2) return;
      setFiatInput(sanitized);

      const num = Number(sanitized);
      if (Number.isFinite(num) && num > 0 && effectiveRate > 0) {
        let c = num / effectiveRate;
        if (
          assetBalance > 0 &&
          c > assetBalance &&
          c - assetBalance < 0.000005
        ) {
          c = assetBalance;
        }
        const cStr = formatAssetAmount(c);
        setCryptoInput(cStr);
        onAmountChange(cStr);
      } else {
        setCryptoInput("");
        onAmountChange("");
      }
    } else {
      const parts = sanitized.split(".");
      if (parts[1] && parts[1].length > 6) return;
      setCryptoInput(sanitized);
      onAmountChange(sanitized);

      const num = Number(sanitized);
      if (Number.isFinite(num) && num > 0 && effectiveRate > 0) {
        const f = (num * effectiveRate).toFixed(2);
        setFiatInput(f);
      } else {
        setFiatInput("");
      }
    }
  };

  const handleSelectPercentage = (pct: number) => {
    setSelectedPercentage(pct);
    const cryptoVal = pct === 100 ? assetBalance : (assetBalance * pct) / 100;
    const cryptoStr = formatAssetAmount(cryptoVal);
    setCryptoInput(cryptoStr);
    onAmountChange(cryptoStr);

    if (effectiveRate > 0) {
      const fiatVal = (cryptoVal * effectiveRate).toFixed(2);
      setFiatInput(fiatVal);
    }
  };

  const handleSwitchToCrypto = () => {
    if (currencyMode !== "crypto") {
      setCurrencyMode("crypto");
      if (selectedPercentage === 100) {
        const cStr = formatAssetAmount(assetBalance);
        setCryptoInput(cStr);
        onAmountChange(cStr);
      } else if (fiatInput && Number(fiatInput) > 0 && effectiveRate > 0) {
        let c = Number(fiatInput) / effectiveRate;
        if (
          assetBalance > 0 &&
          c > assetBalance &&
          c - assetBalance < 0.000005
        ) {
          c = assetBalance;
        }
        const cStr = formatAssetAmount(c);
        setCryptoInput(cStr);
        onAmountChange(cStr);
      }
    }
  };

  const handleSwitchToFiat = () => {
    if (currencyMode !== "fiat") {
      setCurrencyMode("fiat");
      if (selectedPercentage === 100) {
        if (effectiveRate > 0) {
          setFiatInput((assetBalance * effectiveRate).toFixed(2));
        }
      } else if (cryptoInput && Number(cryptoInput) > 0 && effectiveRate > 0) {
        const f = (Number(cryptoInput) * effectiveRate).toFixed(2);
        setFiatInput(f);
      }
    }
  };

  const handleSubmit = () => {
    if (isAmountValid) {
      onContinue();
    }
  };

  const displayPrimaryAmount =
    currencyMode === "fiat"
      ? fiatInput
        ? formatNumberWithCommas(fiatInput)
        : "0"
      : cryptoInput
        ? formatNumberWithCommas(cryptoInput)
        : "0";

  const displaySecondaryText =
    currencyMode === "fiat"
      ? `≈ ${currentCryptoNum > 0 ? formatAssetAmount(currentCryptoNum) : "0"} ${asset || "USDC"}`
      : `≈ ${fiatCurrency} ${formatNumberWithCommas(((currentCryptoNum || 0) * (effectiveRate || 1)).toFixed(2))}`;

  const providerRateText =
    currentCryptoNum > 0
      ? currencyMode === "fiat"
        ? `≈ ${formatAssetAmount(currentCryptoNum)} ${asset || "USDC"}`
        : `≈ ${fiatCurrency} ${formatNumberWithCommas((currentCryptoNum * (effectiveRate || 1)).toFixed(2))}`
      : null;

  const availableFiatVal = (assetBalance * (effectiveRate || 1)).toFixed(2);
  const availableCryptoVal = formatAssetAmount(assetBalance);

  const QuickPercentageButtons = () => (
    <div className="grid w-full grid-cols-4 gap-2 xs:gap-3">
      {QUICK_PERCENTAGES.map((pct) => {
        const isSelected = selectedPercentage === pct;
        const label = pct === 100 ? "Max" : `${pct}%`;
        return (
          <button
            key={pct}
            type="button"
            onClick={() => handleSelectPercentage(pct)}
            className={cn(
              "h-12 w-full cursor-pointer rounded-2xl border text-xs font-semibold transition-all active:scale-[0.98] xs:h-14 xs:text-sm",
              isSelected
                ? "border-primary-60 bg-primary-70/10 text-primary-60"
                : "border-transparent bg-gray-95 text-gray-700 hover:border-primary-60/30 hover:bg-primary-70/5 dark:bg-secondary-60 dark:text-gray-300 dark:hover:bg-secondary-60/80",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex h-full min-h-[calc(100dvh-200px)] flex-col md:min-h-[500px]">
      <div className="flex-1 overflow-y-auto md:px-0">
        <SummaryPill
          asset={asset}
          selectedChain={selectedChain}
          amount={
            currencyMode === "fiat"
              ? currentCryptoNum > 0 && effectiveRate > 0
                ? formatNumberWithCommas(
                    fiatInput && Number(fiatInput) > 0
                      ? Number(fiatInput).toFixed(2)
                      : (currentCryptoNum * effectiveRate).toFixed(2),
                  )
                : undefined
              : currentCryptoNum > 0
                ? formatAssetAmount(currentCryptoNum)
                : undefined
          }
          amountCurrency={
            currencyMode === "fiat" ? fiatCurrency : asset || "USDC"
          }
        />

        {/* Currency Mode Toggle Capsule */}
        <div className="mx-auto mb-3 flex w-fit items-center rounded-full border border-black/5 bg-gray-100 p-0.5 dark:border-white/10 dark:bg-secondary-60/60 xs:p-1 sm:mb-6">
          <button
            type="button"
            onClick={handleSwitchToCrypto}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all xs:gap-2 xs:px-4 xs:py-2 md:text-sm",
              currencyMode === "crypto"
                ? "border border-primary-60/40 bg-white text-primary-60 shadow-sm dark:bg-[#1f2030] dark:text-white"
                : "text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white",
            )}
          >
            <div className="relative h-3.5 w-3.5 shrink-0 overflow-hidden rounded-full xs:h-4 xs:w-4">
              <Image
                src={getAssetIconUrl(asset || "usdc")}
                alt={asset || "crypto"}
                width={16}
                height={16}
                className="rounded-full"
              />
            </div>
            <span>{asset || "USDC"}</span>
          </button>

          <button
            type="button"
            onClick={handleSwitchToFiat}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all xs:gap-2 xs:px-4 xs:py-2 md:text-sm",
              currencyMode === "fiat"
                ? "border border-primary-60/40 bg-white text-primary-60 shadow-sm dark:bg-[#1f2030] dark:text-white"
                : "text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white",
            )}
          >
            <Banknote
              className={cn(
                "h-3.5 w-3.5 xs:h-4 xs:w-4",
                currencyMode === "fiat" ? "text-primary-60" : "text-gray-400",
              )}
            />
            <span>{fiatCurrency}</span>
          </button>
        </div>

        {/* Mobile View: Big clickable amount opening Keypad Drawer */}
        <div className="block w-full lg:hidden">
          <div className="flex flex-col items-center justify-center text-center">
            <button
              type="button"
              onClick={() => setIsAmountEditorOpen(true)}
              className="group mb-1 inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl px-3 py-1.5 transition hover:bg-gray-100 dark:hover:bg-white/5 xs:min-h-14 xs:gap-2.5 xs:px-4 xs:py-2"
              aria-label="Edit amount"
            >
              <span className="text-2xl font-extrabold leading-none text-black dark:text-white xs:text-3xl md:text-4xl">
                {displayPrimaryAmount}
              </span>
              <span
                aria-hidden="true"
                className="h-6 w-0.5 shrink-0 self-center animate-pulse rounded-full bg-primary-60 xs:h-7"
              />
              <span className="text-lg font-bold leading-none text-primary-60 xs:text-xl md:text-2xl">
                {currencyMode === "fiat" ? fiatCurrency : asset || "USDC"}
              </span>
            </button>

            {/* Unified Conversion & Exchange Rate Capsule Badge */}
            {effectiveRate > 0 ? (
              <div className="mx-auto mb-4 mt-1.5 inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-primary-60/25 bg-primary-70/10 px-3.5 py-1 text-xs font-semibold text-primary-60">
                <span>{displaySecondaryText}</span>
                <span className="text-primary-60/40">•</span>
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  1 {asset || "USDC"} ≈ {fiatCurrency}{" "}
                  {formatNumberWithCommas(effectiveRate.toFixed(2))}
                </span>
              </div>
            ) : null}

            {/* Available balance */}
            <div className="mx-auto mb-2 text-center text-xs text-gray-500 dark:text-gray-400">
              Available:{" "}
              <span className="font-semibold text-black dark:text-white">
                {currencyMode === "fiat"
                  ? `≈ ${fiatCurrency} ${formatNumberWithCommas(availableFiatVal)}`
                  : `${availableCryptoVal} ${asset || "USDC"}`}
              </span>
            </div>
          </div>

          {/* Quick Percentage Buttons */}
          <div className="mx-auto mb-4 w-full">
            <QuickPercentageButtons />
          </div>

          {isOverBalance ? (
            <div className="mx-auto mb-4 flex w-full flex-wrap items-center justify-center gap-2 rounded-xl bg-destructive/10 p-2.5 text-destructive">
              <p className="text-xs">
                Insufficient balance. You need{" "}
                {formatAssetAmount(currentCryptoNum - assetBalance)} more{" "}
                {asset || "asset"}.
              </p>
              <BridgeDeficitButton onClick={onBridge} />
            </div>
          ) : null}
        </div>

        {/* Desktop View: Inline Input Card */}
        <div className="hidden lg:block mx-auto mb-4 w-full">
          <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-secondary-50">
            {/* Input field with left currency badge */}
            <div className="relative flex items-center">
              <div className="absolute left-0 top-0 flex h-full items-center justify-center rounded-l-2xl border-r border-black/5 bg-gray-100 px-4 dark:border-white/10 dark:bg-secondary-60/50">
                <div className="flex items-center gap-2">
                  {currencyMode === "crypto" ? (
                    <div className="relative h-4 w-4 shrink-0 overflow-hidden rounded-full">
                      <Image
                        src={getAssetIconUrl(asset || "usdc")}
                        alt={asset || "crypto"}
                        width={16}
                        height={16}
                        className="rounded-full"
                      />
                    </div>
                  ) : (
                    <Banknote className="h-4 w-4 text-primary-60" />
                  )}
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                    {currencyMode === "fiat" ? fiatCurrency : asset || "USDC"}
                  </span>
                </div>
              </div>
              <Input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={currencyMode === "fiat" ? fiatInput : cryptoInput}
                onChange={(e) => handleDesktopInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && isAmountValid) {
                    handleSubmit();
                  }
                }}
                className="h-14 rounded-2xl border-black/5 bg-gray-50 pl-32 pr-4 text-center text-xl font-bold placeholder:text-gray-400 focus-visible:ring-primary-70/20 dark:border-white/10 dark:bg-secondary-60 dark:text-white"
              />
            </div>

            {/* Available balance info */}
            <div className="mt-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
              {currencyMode === "fiat" ? (
                <span>
                  Available: ≈ {fiatCurrency}{" "}
                  {formatNumberWithCommas(availableFiatVal)}
                </span>
              ) : (
                <span>
                  {availableCryptoVal} {asset || "USDC"} available
                </span>
              )}
            </div>

            {/* Exchange rate display */}
            {effectiveRate > 0 ? (
              <div className="mt-3 flex items-center justify-center">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-primary-60/30 bg-primary-70/10 px-3.5 py-1 text-xs font-bold text-primary-60">
                  <ArrowLeftRight className="h-3.5 w-3.5 text-primary-60" />
                  <span>
                    1 {asset || "USDC"} ≈ {fiatCurrency}{" "}
                    {formatNumberWithCommas(effectiveRate.toFixed(2))}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Insufficient balance warning */}
            {isOverBalance ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-destructive/10 p-3 text-destructive">
                <p className="text-xs">
                  Insufficient balance. You need{" "}
                  {formatAssetAmount(currentCryptoNum - assetBalance)} more{" "}
                  {asset || "asset"}.
                </p>
                <BridgeDeficitButton onClick={onBridge} />
              </div>
            ) : null}

            {/* Quick Percentage Buttons inside desktop card */}
            <div className="mt-6">
              <QuickPercentageButtons />
            </div>
          </div>
        </div>

        {/* Payment Provider & Payout Method Cards */}
        <div className="mx-auto w-full space-y-3">
          {/* Payment Provider */}
          {providers.length > 0 && selectedProvider ? (
            <ProviderSelectorTrigger
              selectedProvider={selectedProvider}
              onClick={() => setIsProviderModalOpen(true)}
              isRatesLoading={isRatesLoading}
              rateText={providerRateText}
              isBestRate={isBestRate}
            />
          ) : null}

          {/* Payout Method */}
          <div className="flex w-full items-center justify-between rounded-2xl border border-black/5 bg-white p-2.5 dark:border-white/10 dark:bg-secondary-50 xs:p-3 sm:p-4">
            <span className="text-[10px] font-light capitalize text-gray-500 dark:text-gray-400 xs:text-xs">
              Payout method
            </span>
            <div className="flex items-center gap-1.5 text-xs font-bold text-black dark:text-white xs:gap-2">
              <Landmark className="h-3.5 w-3.5 text-primary-70 xs:h-4 xs:w-4" />
              <span>Bank Transfer</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer Button pinned at bottom of screen */}
      {!isAmountEditorOpen ? (
        <FlowActionFooter
          onClick={handleSubmit}
          disabled={!isAmountValid}
          showShimmer={isAmountValid}
        >
          Continue
          {isAmountValid ? (
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          ) : null}
        </FlowActionFooter>
      ) : null}

      {/* Keypad Drawer for Mobile/Custom Input */}
      <Drawer open={isAmountEditorOpen} onOpenChange={setIsAmountEditorOpen}>
        <DrawerContent className="rounded-t-[28px] border-black/5 bg-linear-to-br from-violet1/10 via-gray-90 to-violet1/10 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 dark:border-white/10 dark:bg-none dark:bg-secondary-50 xs:px-4 [&>div:first-child]:hidden">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Enter amount</DrawerTitle>
          </DrawerHeader>
          <div className="mx-auto w-full max-w-md">
            <div className="mb-3 text-center xs:mb-4">
              <p className="text-xl font-bold text-black dark:text-white xs:text-2xl">
                {displayPrimaryAmount}{" "}
                <span className="text-primary-60">
                  {currencyMode === "fiat" ? fiatCurrency : asset || "USDC"}
                </span>
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 xs:text-xs">
                {displaySecondaryText}
              </p>
            </div>

            <FlowActionFooter
              sticky={false}
              className="mb-3 xs:mb-4"
              onClick={() => {
                setIsAmountEditorOpen(false);
                if (isAmountValid) {
                  handleSubmit();
                }
              }}
              disabled={!isAmountValid}
              buttonClassName={cn(
                !isAmountValid && "from-gray-400 to-gray-500",
              )}
              textClassName="text-sm"
              showShimmer={isAmountValid}
            >
              {isAmountValid ? "Done" : "Enter Valid Amount"}
              {isAmountValid && (
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              )}
            </FlowActionFooter>

            <Keypad
              onPress={handleKeypadPress}
              className="gap-2 xs:gap-3"
              buttonClassName="h-12 xs:h-14 rounded-2xl bg-white dark:bg-secondary-60"
            />
          </div>
        </DrawerContent>
      </Drawer>

      <SelectProviderModal
        isOpen={isProviderModalOpen}
        onClose={() => setIsProviderModalOpen(false)}
        providers={sortedProviders}
        selectedProviderId={selectedProviderId || null}
        onSelectProvider={(id) => onSelectProvider?.(id)}
        providerRates={providerRates}
        isRatesLoading={isRatesLoading}
        asset={asset}
        fiatCurrency={fiatCurrency}
        mode="withdraw"
      />
    </div>
  );
}
