"use client"

import { ArrowLeft, X } from "lucide-react"
import { Form } from "@/components/ui/form"
import FlowStepIndicator from "@/components/wallet/shared/FlowStepIndicator"
import { getChainLabel } from "@/lib/chains"
import type { User } from "@/types/db"
import GiftSuccessModal from "./GiftSuccessModal"
import type { GiftStep } from "./gift-utils"
import GiftDesktopForm from "./steps/GiftDesktopForm"
import GiftDetailsStep from "./steps/GiftDetailsStep"
import GiftExitConfirmation from "./steps/GiftExitConfirmation"
import GiftIntroStep from "./steps/GiftIntroStep"
import GiftReviewStep from "./steps/GiftReviewStep"
import GiftStyleStep from "./steps/GiftStyleStep"
import { useGiftFlow } from "./use-gift-flow"

interface GiftFlowProps {
  profile: User
}

const stepTitles: Record<GiftStep, string> = {
  intro: "Crypto Gift Cards",
  style: "Crypto Gift Cards",
  details: "Crypto Gift Cards",
  review: "Crypto Gift Cards",
}

export default function GiftFlow({ profile }: GiftFlowProps) {
  const giftFlow = useGiftFlow(profile)
  const {
    form,
    assets,
    step,
    selectedTemplate,
    selectedTemplateId,
    selectedAsset,
    selectedSymbol,
    amount,
    normalizedRecipient,
    cardTitle,
    message,
    lookupMessage,
    verifiedRecipient,
    isVerifyingRecipient,
    hasEnoughBalance,
    canReview,
    canSend,
    isSending,
    isSuccessOpen,
    isExitOpen,
    indicatorSteps,
    indicatorCurrentStep,
    goBack,
    closeFlow,
    stayInFlow,
    leaveFlow,
    setIsSuccessOpen,
    handleAmountChange,
    handleTemplateSelect,
    handleReview,
    handleSendGift,
    goToStyle,
    goToDetails,
  } = giftFlow

  const renderStep = () => {
    if (step === "intro") {
      return <GiftIntroStep onContinue={goToStyle} />
    }

    if (step === "style") {
      return (
        <>
          <div className="md:hidden">
            <GiftStyleStep
            selectedTemplateId={selectedTemplateId}
            onSelect={handleTemplateSelect}
            onContinue={goToDetails}
          />
        </div>
          <GiftDesktopForm
            form={form}
            assets={assets}
            selectedAsset={selectedAsset}
            selectedTemplateId={selectedTemplateId}
            lookupMessage={lookupMessage}
            verifiedRecipient={verifiedRecipient}
            isVerifyingRecipient={isVerifyingRecipient}
            hasEnoughBalance={hasEnoughBalance}
            canReview={canReview}
            isCustomTemplate={selectedTemplate.id === "custom"}
            onSelectTemplate={handleTemplateSelect}
            onAmountChange={handleAmountChange}
            onReview={handleReview}
          />
        </>
      )
    }

    if (step === "details") {
      return (
        <GiftDetailsStep
          form={form}
          assets={assets}
          selectedAsset={selectedAsset}
          lookupMessage={lookupMessage}
          verifiedRecipient={verifiedRecipient}
          isVerifyingRecipient={isVerifyingRecipient}
          hasEnoughBalance={hasEnoughBalance}
          canReview={canReview}
          isCustomTemplate={selectedTemplate.id === "custom"}
          onAmountChange={handleAmountChange}
          onReview={handleReview}
        />
      )
    }

    return (
      <GiftReviewStep
        template={selectedTemplate}
        amount={amount}
        symbol={selectedSymbol}
        chain={getChainLabel(selectedAsset?.chain || "base")}
        recipient={normalizedRecipient}
        cardTitle={
          selectedTemplate.id === "custom"
            ? cardTitle.trim() || selectedTemplate.title
            : selectedTemplate.title
        }
        message={message}
        isSending={isSending}
        canSend={canSend}
        onSend={handleSendGift}
      />
    )
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden text-cryptoNight dark:text-white">
      <main className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-col px-4 pb-28 pt-5 md:px-6 md:pb-14 md:pt-20">
        <header className="mb-8 flex items-center justify-between gap-4 md:mb-10">
          <button
            type="button"
            onClick={goBack}
            className="cursor-pointer rounded-full border border-slate-200 bg-gray-100 p-2 dark:border-none dark:bg-secondary-60/50"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <h1 className="text-center text-xl font-bold md:text-2xl">
            {stepTitles[step]}
          </h1>

          <button
            type="button"
            onClick={closeFlow}
            className="cursor-pointer rounded-full border border-slate-200 bg-gray-100 p-2 dark:border-none dark:bg-secondary-60/50"
            aria-label="Close gifts"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {step !== "intro" ? (
          <FlowStepIndicator
            currentStep={indicatorCurrentStep}
            totalSteps={indicatorSteps}
          />
        ) : null}

        <Form {...form}>{renderStep()}</Form>
      </main>

      <GiftSuccessModal
        open={isSuccessOpen}
        onOpenChange={setIsSuccessOpen}
        amount={amount || "0"}
        symbol={selectedSymbol}
        chain={getChainLabel(selectedAsset?.chain || "base")}
        recipient={normalizedRecipient}
        onDone={leaveFlow}
      />
      <GiftExitConfirmation
        open={isExitOpen}
        onStay={stayInFlow}
        onLeave={leaveFlow}
      />
    </div>
  )
}
