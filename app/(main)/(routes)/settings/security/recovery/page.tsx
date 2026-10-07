import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SocialRecoveryPage from "@/components/settings/security/SocialRecoveryPage";
import { currentProfile } from "@/lib/current-profile";

export const metadata: Metadata = {
  title: "Social Recovery | Kellon",
  description: "Manage guardians and recover access to your Kellon account.",
  robots: { index: false, follow: false },
};

export default async function RecoveryPage() {
  const profile = await currentProfile();
  if (!profile) redirect("/");

  return <SocialRecoveryPage />;
}
