"use client"

import { ArrowRight, Gift } from "lucide-react"
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter"

interface GiftIntroStepProps {
  onContinue: () => void
}

export default function GiftIntroStep({ onContinue }: GiftIntroStepProps) {
  return (
    <section className="flex flex-1 flex-col justify-center pb-6 text-center md:mx-auto md:w-full md:max-w-4xl">
      <div className="grid items-center gap-8 md:grid-cols-[0.85fr_1fr] md:text-left">
        <div>
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] text-primary-60 dark:text-primary-80 md:mx-0 md:h-28 md:w-28">
            <Gift className="h-20 w-20 md:h-24 md:w-24" strokeWidth={1.7} />
          </div>
          <h2 className="mt-7 text-3xl font-bold leading-tight md:text-4xl">
            Share Crypto Gifts with Anyone, Anywhere
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-gray-500 dark:text-gray-400 md:mx-0">
            Send gifts fast, easily, and securely on Kellon.
          </p>
        </div>

        <div className="mx-auto w-full max-w-lg space-y-5 text-left">
          {[
            ["Enter your gift amount", ""],
            [
              "Share via Email or Username",
              "Send directly to any Kellon user or invite friends via email",
            ],
            [
              "Available Instantly",
              "Recipients can claim their crypto gift immediately",
            ],
          ].map(([title, description], index) => (
            <div
              key={title}
              className="flex gap-4 rounded-2xl border border-black/5 bg-white/70 p-4 shadow-sm dark:border-white/10 dark:bg-secondary-50/40"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary-80/30 bg-primary-95 text-sm font-bold text-primary-60 dark:border-primary-80/20 dark:bg-secondary-60 dark:text-primary-80">
                {index + 1}
              </div>
              <div>
                <p className="text-sm font-bold text-black dark:text-white md:text-base">
                  {title}
                </p>
                {description ? (
                  <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400 md:text-sm">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
          ))}

          <div className="flex gap-4">
            <div className="hidden h-10 w-10 shrink-0 md:block" />
            <FlowActionFooter
              sticky={false}
              onClick={onContinue}
              className="w-full border-0 px-0"
            >
              Create Gift
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </FlowActionFooter>
          </div>
        </div>
      </div>
    </section>
  )
}
