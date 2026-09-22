import { FC } from "react"
import { redirect } from "next/navigation"
import { User } from "@/types/db"
import DashboardClient from "@/components/wallet/dashboard/Dashboard"
import { currentProfile } from "@/lib/current-profile"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Wallet Dashboard",
  description:
    "View your Kellon balances, assets, and recent activity across your wallet in one place.",
  alternates: {
    canonical: "/",
  },
}

const Page: FC = async ({}) => {
  const profile = (await currentProfile()) as User
  if (!profile) return redirect("/continue")

  return (
    <section className="min-h-screen">
      <DashboardClient profile={profile} />
    </section>
  )
}

export default Page
