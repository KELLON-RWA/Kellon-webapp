"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import AddFundsModal from "@/components/modals/AddFundsModal";
import BridgeFundingOverlay, {
  type BridgeFundingRequest,
} from "@/components/wallet/bridge/BridgeFundingOverlay";
import StepIndicator from "@/components/wallet/shared/FlowStepIndicator";
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter";
import FlowHeader from "@/components/wallet/shared/FlowHeader";
import type { User } from "@/types/db";
import { useUser } from "@/hooks/use-user";
import AmountStep from "./AmountStep";
import AssetStep from "./AssetStep";
import RecentsPanel from "./RecentsPanel";
import RecipientStep from "./RecipientStep";
import ReviewStep from "./ReviewStep";
import TransferVerificationModal from "./TransferVerificationModal";
import { SEND_STEPS, stepTitles } from "./send-utils";
import { useSendFlow } from "./use-send-flow";

interface SendFlowProps {
  profile: User;
}

export default function SendFlow({ profile }: SendFlowProps) {
  const [bridgeRequest, setBridgeRequest] =
    useState<BridgeFundingRequest | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const updateViewport = () => setIsDesktop(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  const { data: liveProfile } = useUser(profile, { live: true });
  const activeProfile = liveProfile || profile;
  const {
    amount,
    amountForm,
    amountValue,
    closeTransferVerification,
    closeSend,
    goBack,
    goNext,
    handleAmountKeypadPress,
    handleRecipientChange,
    isAddFundsOpen,
    isAmountValid,
    isRecipientValid,
    isResendingVerification,
    isSubmitting,
    isVerifyingRecipient,
    primaryButtonDisabled,
    recentRecipients,
    recipientForm,
    recipientInput,
    recipientKind,
    recipientLookupMessage,
    selectedAsset,
    selectRecentRecipient,
    selectTransferVerificationMethod,
    sendableAssets,
    setAmount,
    setIsAddFundsOpen,
    setSelectedAssetId,
    setStep,
    selfRecipientError,
    step,
    submitTransfer,
    submitTransferVerification,
    resendTransferVerification,
    verificationRequest,
    verifiedRecipient,
    verifyRecipient,
  } = useSendFlow(activeProfile);

  const isCombinedAssetAndAmountStep =
    isDesktop && (step === "asset" || step === "amount");
  const visibleSteps = isDesktop
    ? (["recipient", "asset", "review"] as const)
    : SEND_STEPS;
  const currentStepIndex = isDesktop
    ? step === "recipient"
      ? 0
      : step === "review"
        ? 2
        : 1
    : SEND_STEPS.indexOf(step);
  const primaryActionDisabled = isCombinedAssetAndAmountStep
    ? !isAmountValid
    : primaryButtonDisabled;

  const handlePrimaryAction = () => {
    if (step === "review") {
      submitTransfer();
      return;
    }

    if (isCombinedAssetAndAmountStep) {
      if (isAmountValid) setStep("review");
      return;
    }

    goNext();
  };

  return (
    <div className="container mx-auto flex min-h-[90dvh] max-w-2xl flex-col pb-32 md:pt-20">
      <FlowHeader
        title={isCombinedAssetAndAmountStep ? "Send" : stepTitles[step]}
        onBack={goBack}
        onClose={closeSend}
        closeLabel="Close send flow"
        className="mb-8 px-4 pt-4"
      />

      <StepIndicator
        currentStep={currentStepIndex}
        totalSteps={visibleSteps.length}
      />

      <div
        className={
          step === "review"
            ? "mx-auto flex w-11/12 min-w-0 flex-1 flex-col gap-8 pt-1 md:w-lg"
            : "mx-auto flex w-11/12 min-w-0 flex-1 flex-col gap-5 pt-4 md:w-lg"
        }
      >
        <section
          className={
            step === "review"
              ? "h-full min-w-0 overflow-visible"
              : "h-full min-w-0 overflow-visible md:overflow-hidden md:rounded-[24px] md:border md:border-black/5 md:bg-white/80 md:p-6 md:shadow-sm md:dark:border-white/10 md:dark:bg-secondary-50/80 md:dark:shadow-none"
          }
        >
          {step === "recipient" ? (
            <RecipientStep
              recipientForm={recipientForm}
              recipientInput={recipientInput}
              recipientKind={recipientKind}
              isRecipientValid={isRecipientValid}
              selfRecipientError={selfRecipientError}
              verifiedRecipient={verifiedRecipient}
              isVerifyingRecipient={isVerifyingRecipient}
              recipientLookupMessage={recipientLookupMessage}
              onVerifyRecipient={verifyRecipient}
              onRecipientChange={handleRecipientChange}
            />
          ) : null}

          {isCombinedAssetAndAmountStep ? (
            <div className="flex min-w-0 flex-col gap-6">
              <AssetStep
                sendableAssets={sendableAssets}
                selectedAsset={selectedAsset}
                onSelectAsset={setSelectedAssetId}
                onOpenAddFunds={() => setIsAddFundsOpen(true)}
              />
              <div className="border-t border-black/5 pt-6 dark:border-white/10">
                <AmountStep
                  amountForm={amountForm}
                  amount={amount}
                  selectedAsset={selectedAsset}
                  isAmountValid={isAmountValid}
                  onAmountChange={setAmount}
                  onKeypadPress={handleAmountKeypadPress}
                  onReview={() => setStep("review")}
                  onBridge={() => {
                    if (!selectedAsset) return;
                    setBridgeRequest({
                      symbol: selectedAsset.symbol,
                      targetChain: selectedAsset.chain,
                      requiredAmount: amountValue,
                      targetBalance: selectedAsset.amount,
                    });
                  }}
                />
              </div>
            </div>
          ) : null}

          {step === "asset" && !isCombinedAssetAndAmountStep ? (
            <AssetStep
              sendableAssets={sendableAssets}
              selectedAsset={selectedAsset}
              onSelectAsset={setSelectedAssetId}
              onOpenAddFunds={() => setIsAddFundsOpen(true)}
            />
          ) : null}

          {step === "amount" && !isCombinedAssetAndAmountStep ? (
            <AmountStep
              amountForm={amountForm}
              amount={amount}
              selectedAsset={selectedAsset}
              isAmountValid={isAmountValid}
              onAmountChange={setAmount}
              onKeypadPress={handleAmountKeypadPress}
              onReview={() => setStep("review")}
              onBridge={() => {
                if (!selectedAsset) return;
                setBridgeRequest({
                  symbol: selectedAsset.symbol,
                  targetChain: selectedAsset.chain,
                  requiredAmount: amountValue,
                  targetBalance: selectedAsset.amount,
                });
              }}
            />
          ) : null}

          {step === "review" ? (
            <ReviewStep
              amountValue={amountValue}
              selectedAsset={selectedAsset}
              recipientInput={recipientInput}
              recipientKind={recipientKind}
            />
          ) : null}
        </section>

        <div className="flex min-w-0 flex-col gap-5">
          {step === "recipient" ? (
            <RecentsPanel
              recentRecipients={recentRecipients}
              onSelectRecipient={selectRecentRecipient}
            />
          ) : null}

          <FlowActionFooter
            sticky={false}
            className="w-full min-w-0 max-w-full"
            innerClassName="w-full min-w-0"
            buttonClassName="min-w-0"
            onClick={handlePrimaryAction}
            disabled={primaryActionDisabled}
          >
            {step === "review"
              ? isSubmitting
                ? "Sending..."
                : "Send Now"
              : step === "recipient" && isVerifyingRecipient
                ? "Verifying..."
                : "Continue"}
            {step !== "review" ? (
              <ArrowRight className="h-5 w-5" />
            ) : null}
          </FlowActionFooter>
        </div>
      </div>

      <AddFundsModal isOpen={isAddFundsOpen} onClose={setIsAddFundsOpen} />
      <TransferVerificationModal
        isOpen={Boolean(verificationRequest)}
        isSubmitting={isSubmitting}
        verificationType={verificationRequest?.verificationType || "email_otp"}
        availableMethods={verificationRequest?.availableMethods}
        selectedMethod={verificationRequest?.selectedMethod}
        onMethodChange={selectTransferVerificationMethod}
        otpSent={verificationRequest?.otpSent}
        onResend={resendTransferVerification}
        isResending={isResendingVerification}
        onClose={closeTransferVerification}
        onSubmit={submitTransferVerification}
      />
      <BridgeFundingOverlay
        profile={activeProfile}
        request={bridgeRequest}
        onOpenChange={(open) => !open && setBridgeRequest(null)}
      />
    </div>
  );
}
