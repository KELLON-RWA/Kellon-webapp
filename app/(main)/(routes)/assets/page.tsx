import { redirect } from "next/navigation";
import AssetsPage from "@/components/wallet/assets/AssetsPage";
import { currentProfile } from "@/lib/current-profile";
import type { User } from "@/types/db";

export default async function Page() {
  const profile = (await currentProfile()) as User;
  if (!profile) redirect("/continue");

  return <AssetsPage profile={profile} />;
}
