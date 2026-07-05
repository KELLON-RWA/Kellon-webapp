"use client";

import { ArrowLeft, ArrowRight, Send, X } from "lucide-react";
import AddFundsModal from "@/components/modals/AddFundsModal";
import StepIndicator from "@/components/wallet/shared/FlowStepIndicator";
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter";
import type { User } from "@/types/db";
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
    sendableAssets,
    setAmount,
    setIsAddFundsOpen,
    setSelectedAssetId,
    setStep,
    selfRecipientError,
    step,
    submitTransfer,
    submitTransferVerification,
    verificationRequest,
    verifiedRecipient,
    verifyRecipient,
  } = useSendFlow(profile);

  return (
    <div className="mx-auto flex min-h-[90dvh] w-full max-w-full flex-col overflow-x-hidden px-4 pb-32 pt-4 md:container md:max-w-5xl md:px-6 md:pt-28">
      <div className="mb-8 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          className="rounded-full border border-gray-80 bg-white p-2 text-gray-20 transition hover:bg-gray-95 hover:text-cryptoNight dark:border-white/10 dark:bg-secondary-60/50 dark:text-white dark:hover:bg-secondary-60 cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <h1 className="text-lg font-bold text-black dark:text-white md:text-2xl">
          {stepTitles[step]}
        </h1>

        <button
          type="button"
          onClick={closeSend}
          className="rounded-full border border-gray-80 bg-white p-2 text-gray-20 transition hover:bg-gray-95 hover:text-cryptoNight dark:border-white/10 dark:bg-secondary-60/50 dark:text-white dark:hover:bg-secondary-60 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <StepIndicator
        currentStep={SEND_STEPS.indexOf(step)}
        totalSteps={SEND_STEPS.length}
      />

      <div className="mx-auto grid w-full min-w-0 max-w-full gap-5 md:max-w-5xl md:grid-cols-2 md:items-start">
        <section className="h-full min-w-0 overflow-hidden rounded-[24px] border border-black/5 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-secondary-50/80 dark:shadow-none md:p-6">
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

          {step === "asset" ? (
            <AssetStep
              sendableAssets={sendableAssets}
              selectedAsset={selectedAsset}
              onSelectAsset={setSelectedAssetId}
              onOpenAddFunds={() => setIsAddFundsOpen(true)}
            />
          ) : null}

          {step === "amount" ? (
            <AmountStep
              amountForm={amountForm}
              amount={amount}
              selectedAsset={selectedAsset}
              isAmountValid={isAmountValid}
              onAmountChange={setAmount}
              onKeypadPress={handleAmountKeypadPress}
              onReview={() => setStep("review")}
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
          <RecentsPanel
            recentRecipients={recentRecipients}
            onSelectRecipient={selectRecentRecipient}
          />

          <FlowActionFooter
            sticky={false}
            className="w-full min-w-0 max-w-full"
            innerClassName="w-full min-w-0"
            buttonClassName="min-w-0"
            onClick={step === "review" ? submitTransfer : goNext}
            disabled={primaryButtonDisabled}
          >
            {step === "review"
              ? isSubmitting
                ? "Sending..."
                : "Send Now"
              : step === "recipient" && isVerifyingRecipient
                ? "Verifying..."
                : "Continue"}
            {step === "review" ? (
              <Send className="h-5 w-5" />
            ) : (
              <ArrowRight className="h-5 w-5" />
            )}
          </FlowActionFooter>
        </div>
      </div>

      <AddFundsModal isOpen={isAddFundsOpen} onClose={setIsAddFundsOpen} />
      <TransferVerificationModal
        isOpen={Boolean(verificationRequest)}
        isSubmitting={isSubmitting}
        verificationType={verificationRequest?.verificationType || "otp"}
        onClose={closeTransferVerification}
        onSubmit={submitTransferVerification}
      />
    </div>
  );
}
