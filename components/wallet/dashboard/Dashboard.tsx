"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import AddFundsModal from "@/components/modals/AddFundsModal"
import WalletServicesModal from "@/components/modals/WalletServicesModal"
import { getGreeting } from "@/lib/utils"
import type { User } from "@/types/db"
import ActivityPanel from "./ActivityPanel"
import AssetsPanel from "./AssetsPanel"
import DashboardHeader from "./DashboardHeader"
import PortfolioAllocationPanel from "./PortfolioAllocationPanel"
import PortfolioBalanceCard from "./PortfolioBalanceCard"
import QuickActionsPanel from "./QuickActionsPanel"
import TopMoversPanel from "./TopMoversPanel"
import { useDashboardData } from "@/lib/use-dashboard-data"
import { useUser } from "@/hooks/use-user"
import { isRwaStockListing, stocksService } from "@/services/api/stocks"
import { yieldService } from "@/services/api/yield"
import { PositionStatus } from "@/types/db"

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
  const { data: yieldPositions = [], isLoading: isYieldPositionsLoading } = useQuery({
    queryKey: ["yield-positions"],
    queryFn: async () => (await yieldService.getPositions()).data,
    staleTime: 30_000,
  })
  const { data: yieldOpportunities = [] } = useQuery({
    queryKey: ["yield-opportunities"],
    queryFn: async () => (await yieldService.getOpportunities()).data,
    staleTime: 60_000,
  })
  const activeYieldPositions = useMemo(
    () => yieldPositions.filter((position) => position.status !== PositionStatus.CLOSED),
    [yieldPositions],
  )
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
            price: Number(listing?.price || holding.currentPrice) || 0,
            change24hPercentage: Number(
              listing?.change24hPercentage ?? listing?.changePercentage ?? 0,
            ),
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
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 pb-32 pt-4 md:space-y-6 md:px-6 md:pb-12 md:pt-28 min-[1024px]:max-w-none min-[1024px]:space-y-4 min-[1024px]:px-6 min-[1024px]:pt-24 min-[1200px]:px-8">
      <DashboardHeader greeting={greeting} profile={activeProfile} />

      <div className="grid grid-cols-1 gap-6 min-[1024px]:gap-4 min-[1280px]:grid-cols-12 min-[1280px]:items-start min-[1440px]:grid-cols-[minmax(0,1fr)_34rem]">
        <div className="contents min-[1280px]:col-span-8 min-[1280px]:flex min-[1280px]:min-w-0 min-[1280px]:flex-col min-[1280px]:gap-4 min-[1280px]:h-full min-[1440px]:col-span-1">
          <PortfolioBalanceCard
            activeBalanceLabel={dashboard.activeBalanceLabel}
            assetCountLabel={dashboard.assetCountLabel}
            canToggleCurrency={dashboard.canToggleCurrency}
            countryCode={dashboard.countryCode}
            flag={dashboard.flag}
            hiddenActiveBalanceLabel={dashboard.hiddenActiveBalanceLabel}
            hiddenSecondaryBalanceLabel={dashboard.hiddenSecondaryBalanceLabel}
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
          <div className="hidden min-[1024px]:order-2 min-[1024px]:block min-[1280px]:hidden">
            <QuickActionsPanel
              onAddFunds={() => setIsAddFundsOpen(true)}
              onSend={() => router.push("/send")}
              onWithdraw={() => router.push("/withdraw")}
              onMore={() => setIsWalletServicesOpen(true)}
            />
          </div>
          <AssetsPanel
            activeCurrency={dashboard.activeCurrency}
            displayCurrency={dashboard.displayCurrency}
            groupedAssets={dashboard.groupedAssets}
            investmentAssets={investmentAssets}
            isInvestmentsLoading={isStockPortfolioLoading}
            isAssetValueLoading={dashboard.isAssetValueLoading}
            isBalanceVisible={dashboard.isBalanceVisible}
            yieldOpportunities={yieldOpportunities}
            yieldPositions={activeYieldPositions}
            isYieldPositionsLoading={isYieldPositionsLoading}
          />
        </div>

        <aside className="contents min-[1024px]:order-4 min-[1024px]:grid min-[1024px]:min-w-0 min-[1024px]:grid-cols-2 min-[1024px]:items-start min-[1024px]:gap-3 min-[1280px]:order-none min-[1280px]:col-span-4 min-[1280px]:flex min-[1280px]:flex-col min-[1280px]:items-stretch min-[1440px]:col-span-1">
          <div className="order-2 min-[1024px]:hidden min-[1280px]:order-none min-[1280px]:block min-[1280px]:w-full">
            <QuickActionsPanel
              onAddFunds={() => setIsAddFundsOpen(true)}
              onSend={() => router.push("/send")}
              onWithdraw={() => router.push("/withdraw")}
              onMore={() => setIsWalletServicesOpen(true)}
            />
          </div>
          <PortfolioAllocationPanel
            groupedAssets={dashboard.groupedAssets}
            investmentAssets={investmentAssets}
            yieldPositions={activeYieldPositions}
            exchangeRate={dashboard.exchangeRate}
            activeCurrency={dashboard.activeCurrency}
            isBalanceVisible={dashboard.isBalanceVisible}
          />
          <TopMoversPanel listings={stockListings} />
          <ActivityPanel
            isBalanceVisible={dashboard.isBalanceVisible}
            isTransactionsLoading={dashboard.isTransactionsLoading}
            recentTransactions={dashboard.recentTransactions}
            transactionsError={dashboard.transactionsError}
          />
        </aside>
      </div>

      <AddFundsModal isOpen={isAddFundsOpen} onClose={setIsAddFundsOpen} />
      <WalletServicesModal
        isOpen={isWalletServicesOpen}
        onClose={setIsWalletServicesOpen}
      />
    </div>
  )
}
