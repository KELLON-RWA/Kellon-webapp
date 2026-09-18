"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import AddFundsModal from "@/components/modals/AddFundsModal"
import WalletServicesModal from "@/components/modals/WalletServicesModal"
import { cn, getGreeting } from "@/lib/utils"
import type { User } from "@/types/db"
import ActivityPanel from "./ActivityPanel"
import AssetsPanel from "./AssetsPanel"
import DashboardHeader from "./DashboardHeader"
import EarnPreviewPanel from "./EarnPreviewPanel"
import PortfolioBalanceCard from "./PortfolioBalanceCard"
import QuickActionsPanel from "./QuickActionsPanel"
import { useDashboardData } from "@/lib/use-dashboard-data"
import { useUser } from "@/hooks/use-user"
import { isRwaStockListing, stocksService } from "@/services/api/stocks"

function getStockTicker(symbol: string) {
  const raw = symbol.trim()
  const withoutProviderSuffix = /[bc]$/i.test(raw) ? raw.slice(0, -1) : raw

  return (withoutProviderSuffix.startsWith("b")
    ? withoutProviderSuffix.slice(1)
    : withoutProviderSuffix
  ).toUpperCase()
}

function getStockLogo(symbol: string, logoUrl?: string) {
  return (
    logoUrl ||
    `https://images.financialmodelingprep.com/symbol/${encodeURIComponent(getStockTicker(symbol))}.png`
  )
}

interface DashboardClientProps {
  profile: User
}

export default function DashboardClient({ profile }: DashboardClientProps) {
  const router = useRouter()
  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false)
  const [isWalletServicesOpen, setIsWalletServicesOpen] = useState(false)
  const [greeting, setGreeting] = useState("Welcome back")
  const { data: liveProfile } = useUser(profile, { live: true })
  const activeProfile = liveProfile || profile
  const dashboard = useDashboardData(activeProfile)
  const { data: stockPortfolio, isLoading: isStockPortfolioLoading } = useQuery({
    queryKey: ["stock-portfolio"],
    queryFn: async () => (await stocksService.getPortfolio()).data,
    staleTime: 30_000,
  })
  const { data: stockListings = [] } = useQuery({
    queryKey: ["available-stocks"],
    queryFn: async () => (await stocksService.getAvailableStocks("all")).data,
    staleTime: 60_000,
  })
  const investmentAssets = useMemo(
    () =>
      (stockPortfolio?.holdings || [])
        .filter((holding) => Number(holding.shares) > 0)
        .map((holding) => {
          const listing = stockListings.find(
            (stock) =>
              stock.symbol.toLowerCase() === holding.symbol.toLowerCase() &&
              stock.provider.toLowerCase() === holding.provider.toLowerCase(),
          )
          const ticker = getStockTicker(holding.symbol)
          const isRwa = listing
            ? isRwaStockListing(listing)
            : Boolean(holding.rwaCategory)

          return {
            id: `investment:${holding.provider}:${holding.symbol}`,
            symbol: ticker,
            name: (listing?.name || ticker)
              .replace(/\s+[bc]stock$/i, "")
              .trim(),
            shares: Number(holding.shares),
            usdValue: Number(holding.currentValue) || 0,
            localValue:
              (Number(holding.currentValue) || 0) * dashboard.exchangeRate,
            provider: holding.provider,
            kind: isRwa ? ("rwa" as const) : ("stock" as const),
            href: `/earn/stocks/${encodeURIComponent(ticker)}?provider=${encodeURIComponent(holding.provider)}`,
            logoUrl: getStockLogo(holding.symbol, listing?.logoUrl),
          }
        }),
    [dashboard.exchangeRate, stockListings, stockPortfolio?.holdings],
  )

  useEffect(() => {
    setGreeting(getGreeting())
  }, [])

  return (
    <div className="container mx-auto w-full max-w-7xl space-y-6 px-4 pb-32 pt-4 md:space-y-8 md:px-6 md:pb-12 md:pt-28">
      <DashboardHeader greeting={greeting} profile={activeProfile} />

      <div
        className={cn(
          "px-0 py-0 text-gray-20 dark:text-gray-40",
          "rounded-none",
          "md:rounded-xl md:border md:border-white/70 md:bg-white/45 md:p-4 md:shadow-sm md:shadow-primary-90/30 md:backdrop-blur-xl",
          "md:dark:bg-secondary-50/10",
          "md:dark:border-white/0 md:dark:shadow-none",
        )}
      >
        <div className="grid grid-cols-1 gap-6 md:gap-4 min-[900px]:grid-cols-12 min-[900px]:items-start">
          <div className="contents min-[900px]:col-span-8 min-[900px]:flex min-[900px]:w-full min-[900px]:flex-col min-[900px]:gap-4">
            <PortfolioBalanceCard
              activeBalanceLabel={dashboard.activeBalanceLabel}
              assetCountLabel={dashboard.assetCountLabel}
              canToggleCurrency={dashboard.canToggleCurrency}
              countryCode={dashboard.countryCode}
              flag={dashboard.flag}
              hiddenActiveBalanceLabel={dashboard.hiddenActiveBalanceLabel}
              hiddenSecondaryBalanceLabel={
                dashboard.hiddenSecondaryBalanceLabel
              }
              isBalanceVisible={dashboard.isBalanceVisible}
              isDetecting={dashboard.isDetecting}
              isLocalDisplay={dashboard.isLocalDisplay}
              isPortfolioLoading={dashboard.isPortfolioLoading}
              localCurrency={dashboard.localCurrency}
              portfolioLabel={dashboard.portfolioLabel}
              secondaryBalanceLabel={dashboard.secondaryBalanceLabel}
              setDisplayCurrency={dashboard.setDisplayCurrency}
              setIsBalanceVisible={dashboard.setIsBalanceVisible}
              totalNetworks={dashboard.totalNetworks}
            />

            <AssetsPanel
              activeCurrency={dashboard.activeCurrency}
              displayCurrency={dashboard.displayCurrency}
              groupedAssets={dashboard.groupedAssets}
              investmentAssets={investmentAssets}
              isInvestmentsLoading={isStockPortfolioLoading}
              isAssetValueLoading={dashboard.isAssetValueLoading}
              isBalanceVisible={dashboard.isBalanceVisible}
            />
          </div>

          <div className="contents min-[900px]:order-2 min-[900px]:col-span-4 min-[900px]:flex min-[900px]:w-full min-[900px]:flex-col min-[900px]:gap-4">
            <QuickActionsPanel
              onAddFunds={() => setIsAddFundsOpen(true)}
              onSend={() => router.push("/send")}
              onWithdraw={() => router.push("/withdraw")}
              onMore={() => setIsWalletServicesOpen(true)}
            />

            <EarnPreviewPanel />

            <ActivityPanel
              isBalanceVisible={dashboard.isBalanceVisible}
              isTransactionsLoading={dashboard.isTransactionsLoading}
              recentTransactions={dashboard.recentTransactions}
              transactionsError={dashboard.transactionsError}
            />
          </div>
        </div>
      </div>

      <AddFundsModal isOpen={isAddFundsOpen} onClose={setIsAddFundsOpen} />
      <WalletServicesModal
        isOpen={isWalletServicesOpen}
        onClose={setIsWalletServicesOpen}
      />
    </div>
  )
}
