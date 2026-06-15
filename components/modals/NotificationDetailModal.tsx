"use client"

import { Copy, Info, ReceiptText, X } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import HydrationSafeRelativeTime from "@/components/HydrationSafeRelativeTime"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"
import type { Notification } from "@/types/db"

export type NotificationDetailDisplay = {
  category: string
  icon: string
  title: string
  content: string | null
  amountLabel?: string | null
  statusLabel?: string | null
  statusClassName?: string | null
  transactionId?: string | null
}

interface NotificationDetailModalProps {
  isOpen: boolean
  notification: Notification | null
  display: NotificationDetailDisplay | null
  onClose: (open: boolean) => void
}

function shortenId(value: string): string {
  if (value.length <= 16) return value
  return `${value.slice(0, 8)}...${value.slice(-6)}`
}

async function copyValue(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.success("Copied")
  } catch {
    toast.error("Unable to copy")
  }
}

export default function NotificationDetailModal({
  isOpen,
  notification,
  display,
  onClose,
}: NotificationDetailModalProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)")

  if (!notification || !display) return null

  const details = [
    { label: "Type", value: display.category },
    display.statusLabel
      ? {
          label: "Status",
          value: display.statusLabel,
          className: display.statusClassName,
        }
      : null,
    display.amountLabel
      ? { label: "Amount", value: display.amountLabel }
      : null,
    display.transactionId
      ? {
          label: "Transaction ID",
          value: shortenId(display.transactionId),
          copyValue: display.transactionId,
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string
    value: string
    className?: string | null
    copyValue?: string
  }>

  const content = (
    <div className="px-4 pb-8 md:px-0 md:pb-0">
      <div className="mb-7 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-black dark:text-white">
            {display.title}
          </h2>
          <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">
            <HydrationSafeRelativeTime value={notification.createdAt} />
          </p>
        </div>

        <button
          type="button"
          onClick={() => onClose(false)}
          aria-label="Close notification details"
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-black/5 bg-white text-gray-600 shadow-sm transition-opacity hover:opacity-80 dark:border-white/10 dark:bg-secondary-60/50 dark:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-95 text-xl font-semibold text-primary-50 dark:bg-primary-70/15 dark:text-primary-80">
          {display.icon}
        </div>
        <span className="rounded-full bg-primary-95 px-4 py-2 text-sm font-semibold text-primary-50 dark:bg-primary-70/15 dark:text-primary-80">
          {display.category}
        </span>
      </div>

      {display.content && (
        <div className="mb-5 rounded-2xl border border-black/5 bg-white p-4 text-sm font-medium leading-relaxed text-gray-700 dark:border-white/10 dark:bg-secondary-60 dark:text-gray-200">
          {display.content}
        </div>
      )}

      {details.length > 0 && (
        <div className="mb-7 overflow-hidden rounded-2xl border border-black/5 bg-white dark:border-white/10 dark:bg-secondary-60">
          <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-gray-500 dark:border-white/10 dark:text-gray-400">
            <Info className="h-4 w-4" />
            Details
          </div>

          {details.map((detail) => (
            <div
              key={detail.label}
              className="flex items-center justify-between gap-4 border-b border-black/5 px-4 py-3 last:border-b-0 dark:border-white/10"
            >
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {detail.label}
              </span>
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "truncate text-right text-sm font-semibold text-black dark:text-white",
                    detail.className,
                  )}
                >
                  {detail.value}
                </span>
                {detail.copyValue && (
                  <button
                    type="button"
                    onClick={() => copyValue(detail.copyValue as string)}
                    aria-label={`Copy ${detail.label}`}
                    className="shrink-0 cursor-pointer rounded-full p-1 text-gray-400 transition-colors hover:text-primary-50 dark:hover:text-primary-80"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className={cn("grid gap-3", display.transactionId && "md:grid-cols-2")}
      >
        {display.transactionId && (
          <Button asChild variant="flow" size="action" className="w-full">
            <Link
              href={`/transactions/${display.transactionId}`}
              onClick={() => onClose(false)}
            >
              <ReceiptText className="h-4 w-4" />
              <span className="relative z-10 flex items-center justify-center gap-2 text-sm md:text-base">
                View full transaction
              </span>
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
            </Link>
          </Button>
        )}

        <Button
          type="button"
          variant="flowSecondary"
          size="action"
          className="w-full"
          onClick={() => onClose(false)}
        >
          Dismiss
        </Button>
      </div>
    </div>
  )

  if (isDesktop) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-h-[calc(100dvh-4rem)] w-[calc(100%-2rem)] max-w-[460px] overflow-y-auto rounded-[32px] border-none bg-gray-70 p-6 outline-none dark:bg-black2 [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>{display.title}</DialogTitle>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[82dvh] overflow-y-auto rounded-t-[32px] border-none bg-gray-70 outline-none dark:bg-black2 [&>button]:hidden">
        <DrawerHeader className="sr-only">
          <DrawerTitle>{display.title}</DrawerTitle>
        </DrawerHeader>
        {content}
      </DrawerContent>
    </Drawer>
  )
}
