import BottomNavigationBar from "@/components/navigation/BottomNavigationBar"
import Topbar from "@/components/navigation/Topbar"
import { currentProfile } from "@/lib/current-profile"
import { User } from "@/types/db"
import { FC, ReactNode } from "react"
import type { Metadata } from "next"

// Authenticated wallet pages contain private account data and must never be indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

interface layoutProps {
  children: ReactNode
}

const layout: FC<layoutProps> = async ({ children }) => {
  const profile = (await currentProfile()) as User

  return (
    <main id="main-content" tabIndex={-1}>
      <Topbar profile={profile} />
      {children}
      <BottomNavigationBar className="md:hidden z-20" profile={profile} />
    </main>
  )
}

export default layout
