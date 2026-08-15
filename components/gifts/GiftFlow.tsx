"use client"

import { Form } from "@/components/ui/form"
import FlowStepIndicator from "@/components/wallet/shared/FlowStepIndicator"
import FlowHeader from "@/components/wallet/shared/FlowHeader"
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
        <FlowHeader
          title={stepTitles[step]}
          onBack={goBack}
          onClose={closeFlow}
          closeLabel="Close gifts"
          className="mb-8 md:mb-10"
        />

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
