import { redirect } from "next/navigation"
import type { Metadata } from "next"
import SecuritySettingsPage from "@/components/settings/security/SecuritySettingsPage"
import { currentProfile } from "@/lib/current-profile"

export const metadata: Metadata = {
  title: "Security & Backup | Kellon",
  description: "Manage wallet verification, trusted devices, and recovery options.",
  robots: { index: false, follow: false },
}

export default async function SecurityPage() {
  const profile = await currentProfile()
  if (!profile) redirect("/")

  return <SecuritySettingsPage profile={profile} />
}
