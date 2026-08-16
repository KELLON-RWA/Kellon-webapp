"use client"

import { ArrowLeftRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface BridgeDeficitButtonProps {
  onClick: () => void
  className?: string
}

export default function BridgeDeficitButton({
  onClick,
  className,
}: BridgeDeficitButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-primary-60/30 bg-primary-70/10 px-3 py-1.5 text-xs font-bold text-primary-60 transition hover:bg-primary-70/15",
        className,
      )}
    >
      <ArrowLeftRight className="h-3.5 w-3.5" />
      Bridge funds
    </button>
  )
}
