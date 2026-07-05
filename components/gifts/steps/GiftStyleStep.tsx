"use client"

import { ArrowRight } from "lucide-react"
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter"
import GiftTemplateGrid from "./GiftTemplateGrid"

interface GiftStyleStepProps {
  selectedTemplateId: string
  onSelect: (id: string) => void
  onContinue: () => void
}

export default function GiftStyleStep({
  selectedTemplateId,
  onSelect,
  onContinue,
}: GiftStyleStepProps) {
  return (
    <section className="mx-auto flex max-h-[calc(100dvh-190px)] min-h-0 w-full max-w-4xl flex-1 flex-col overflow-hidden md:max-h-[calc(100dvh-260px)]">
      <h2 className="mb-6 text-center text-lg font-bold md:text-xl">
        Pick a style
      </h2>
      <div className="min-h-0 flex-1 overflow-y-auto pb-4 pr-1">
        <GiftTemplateGrid
          selectedTemplateId={selectedTemplateId}
          onSelect={onSelect}
        />
      </div>

      <FlowActionFooter
        onClick={onContinue}
        className="mx-auto w-full max-w-xl border-0 bg-transparent px-0"
      >
        Continue
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </FlowActionFooter>
    </section>
  )
}
