"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  CheckCircle2,
  Clock3,
  Copy,
  FileText,
  Plus,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import HydrationSafeRelativeTime from "@/components/HydrationSafeRelativeTime"
import { Button } from "@/components/ui/button"
import FlowHeader from "@/components/wallet/shared/FlowHeader"
import { invoiceService } from "@/services/api/invoices"
import { cn } from "@/lib/utils"
import { InvoiceStatus, type Invoice } from "@/types/db"

type InvoiceTab = "all" | "pending" | "paid" | "expired"

const INVOICE_TABS: InvoiceTab[] = ["all", "pending", "paid", "expired"]

export default function InvoicesPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<InvoiceTab>("all")

  const { data, isLoading, error } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const response = await invoiceService.listInvoices()
      return response.data || []
    },
  })

  const invoices = useMemo(() => data || [], [data])
  const filteredInvoices = useMemo(() => {
    return [...invoices]
      .filter((invoice) => {
        if (activeTab === "all") return true
        return invoice.status.toLowerCase() === activeTab
      })
      .sort(
        (left, right) =>
          getDateTime(right.createdAt) - getDateTime(left.createdAt),
      )
  }, [activeTab, invoices])

  return (
    <section className="container mx-auto flex min-h-[100dvh] max-w-4xl flex-col px-4 pb-28 pt-4 md:px-6 md:pb-12 md:pt-20">
      <FlowHeader
        title="My Invoices"
        onBack={() => router.back()}
        rightAction={{
          label: "Create invoice",
          icon: <Plus className="h-5 w-5 text-primary-60 dark:text-primary-80" />,
          onClick: () => router.push("/invoices/create"),
        }}
      />

      <div className="mt-7 overflow-x-auto">
        <div className="flex min-w-max gap-2 pb-1">
          {INVOICE_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors cursor-pointer",
                activeTab === tab
                  ? "border-primary-90 bg-primary-95 text-primary-50 dark:border-primary-70/20 dark:bg-primary-70/15 dark:text-primary-80"
                  : "border-gray-80 bg-white/80 text-gray-20 hover:text-cryptoNight dark:border-white/10 dark:bg-secondary-50/70 dark:text-gray-40 dark:hover:text-white",
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 min-h-0 flex-1">
        {isLoading ? (
          <InvoiceListSkeleton />
        ) : error ? (
          <div className="rounded-[24px] border border-black/5 bg-white p-6 text-center dark:border-white/10 dark:bg-secondary-50">
            <p className="text-sm font-medium text-red-500">
              {error instanceof Error
                ? error.message
                : "Unable to load invoices"}
            </p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <EmptyInvoiceState onCreate={() => router.push("/invoices/create")} />
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-black/5 bg-white dark:border-white/10 dark:bg-secondary-50">
            {filteredInvoices.map((invoice) => (
              <InvoiceRow key={invoice.id} invoice={invoice} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function EmptyInvoiceState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-[56dvh] flex-col items-center justify-center text-center">
      <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-primary-95 text-gray-400 dark:bg-secondary-50 dark:text-gray-400 md:h-32 md:w-32">
        <FileText className="h-12 w-12" />
      </div>
      <h2 className="text-2xl font-semibold text-black dark:text-white">
        No invoices yet
      </h2>
      <p className="mt-3 max-w-sm text-sm text-gray-500 dark:text-gray-400">
        Create your first payment request to get paid by customers
      </p>
      <Button
        type="button"
        variant="flow"
        size="flow"
        onClick={onCreate}
        className="mt-8 max-w-[260px]"
      >
        <span className="relative z-10 flex items-center justify-center gap-2 text-sm md:text-base">
          <Plus className="h-5 w-5" />
          Create Invoice
        </span>
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
      </Button>
    </div>
  )
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const paymentUrl = invoice.paymentUrl || getPaymentUrl(invoice.paymentCode)

  const copyPaymentLink = async () => {
    if (!paymentUrl) {
      toast.error("Payment link is not available")
      return
    }

    try {
      await navigator.clipboard.writeText(paymentUrl)
      toast.success("Invoice link copied")
    } catch {
      toast.error("Unable to copy invoice link")
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-black/5 px-4 py-4 last:border-b-0 dark:border-white/10 md:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            getInvoiceStatusTone(invoice.status),
          )}
        >
          {getInvoiceStatusIcon(invoice.status)}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-black dark:text-white">
            {invoice.description || `${invoice.symbol} invoice`}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {invoice.createdAt ? (
                <HydrationSafeRelativeTime value={invoice.createdAt} />
              ) : (
                "Recently"
              )}
            </span>
            <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            <span
              className={cn(
                "text-[10px] font-medium",
                getInvoiceStatusTextClass(invoice.status),
              )}
            >
              {formatInvoiceStatus(invoice.status)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-semibold text-black dark:text-white">
            {formatInvoiceAmount(invoice.amount)} {invoice.symbol}
          </p>
          {invoice.customerName ? (
            <p className="mt-1 max-w-[120px] truncate text-[10px] text-gray-500 dark:text-gray-400">
              {invoice.customerName}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={copyPaymentLink}
          className="rounded-full p-2 text-gray-400 transition-all hover:bg-gray-50 hover:text-black dark:hover:bg-secondary-60/50 dark:hover:text-white cursor-pointer"
          aria-label="Copy invoice payment link"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function InvoiceListSkeleton() {
  return (
    <div className="overflow-hidden rounded-[24px] border border-black/5 bg-white dark:border-white/10 dark:bg-secondary-50">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="flex animate-pulse items-center justify-between gap-4 border-b border-black/5 px-4 py-4 last:border-b-0 dark:border-white/10 md:px-5"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-secondary-60" />
            <div className="space-y-2">
              <div className="h-3.5 w-32 rounded-full bg-gray-100 dark:bg-secondary-60" />
              <div className="h-2.5 w-24 rounded-full bg-gray-100 dark:bg-secondary-60" />
            </div>
          </div>
          <div className="h-3.5 w-20 rounded-full bg-gray-100 dark:bg-secondary-60" />
        </div>
      ))}
    </div>
  )
}

function formatInvoiceAmount(amount: Invoice["amount"]): string {
  const numeric = typeof amount === "string" ? Number(amount) : amount

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: numeric > 0 && numeric < 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numeric) ? numeric : 0)
}

function formatInvoiceStatus(status: InvoiceStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase()
}

function getInvoiceStatusTone(status: InvoiceStatus): string {
  switch (status) {
    case InvoiceStatus.PAID:
      return "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
    case InvoiceStatus.CANCELLED:
    case InvoiceStatus.EXPIRED:
      return "bg-gray-100 text-gray-500 dark:bg-secondary-60 dark:text-gray-400"
    default:
      return "bg-primary-95 text-primary-60 dark:bg-primary-70/15 dark:text-primary-80"
  }
}

function getInvoiceStatusTextClass(status: InvoiceStatus): string {
  switch (status) {
    case InvoiceStatus.PAID:
      return "text-emerald-600 dark:text-emerald-400"
    case InvoiceStatus.CANCELLED:
    case InvoiceStatus.EXPIRED:
      return "text-gray-500 dark:text-gray-400"
    default:
      return "text-primary-60 dark:text-primary-80"
  }
}

function getInvoiceStatusIcon(status: InvoiceStatus) {
  switch (status) {
    case InvoiceStatus.PAID:
      return <CheckCircle2 className="h-4 w-4" />
    case InvoiceStatus.CANCELLED:
    case InvoiceStatus.EXPIRED:
      return <XCircle className="h-4 w-4" />
    default:
      return <Clock3 className="h-4 w-4" />
  }
}

function getPaymentUrl(paymentCode?: string): string | null {
  if (!paymentCode || typeof window === "undefined") return null
  return `${window.location.origin}/invoice/${paymentCode}`
}

function getDateTime(value?: Date | string): number {
  if (!value) return 0
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}
