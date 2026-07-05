"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { GIFT_TEMPLATES } from "../gift-utils"

interface GiftTemplateGridProps {
  selectedTemplateId: string
  onSelect: (id: string) => void
  compact?: boolean
}

export default function GiftTemplateGrid({
  selectedTemplateId,
  onSelect,
  compact = false,
}: GiftTemplateGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3",
        compact ? "md:grid-cols-3 md:gap-3" : "md:grid-cols-3 md:gap-4 lg:grid-cols-4",
      )}
    >
      {GIFT_TEMPLATES.map((template) => {
        const Icon = template.Icon
        const isSelected = template.id === selectedTemplateId

        return (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template.id)}
            className={cn(
              "relative cursor-pointer rounded-2xl bg-gradient-to-br p-4 text-left text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
              compact ? "min-h-20 md:p-3" : "min-h-28 md:min-h-36 md:p-5",
              template.gradient,
              isSelected ? "ring-2 ring-primary-70" : "ring-1 ring-white/10",
            )}
          >
            <Icon
              className={cn(
                "opacity-90",
                compact ? "h-7 w-7" : "h-8 w-8 md:h-9 md:w-9",
              )}
            />
            <p
              className={cn(
                "absolute bottom-4 left-4 text-sm font-bold",
                compact && "bottom-3 left-3 text-xs",
              )}
            >
              {template.title}
            </p>
            {isSelected ? (
              <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary-70 text-white">
                <Check className="h-4 w-4" />
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
