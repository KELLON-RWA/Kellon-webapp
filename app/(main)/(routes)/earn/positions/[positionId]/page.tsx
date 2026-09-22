import type { Metadata } from "next";
import { redirect } from "next/navigation";
import YieldPositionDetailsPage from "@/components/earn/YieldPositionDetailsPage";
import { currentProfile } from "@/lib/current-profile";
import type { User } from "@/types/db";

interface PageProps {
  params: Promise<{ positionId: string }>;
}

export const metadata: Metadata = {
  title: "Yield Position",
  description: "Manage your Kellon yield position.",
};

export default async function YieldPositionRoute({ params }: PageProps) {
  const profile = (await currentProfile()) as User;
  if (!profile) redirect("/");

  const { positionId } = await params;
  return <YieldPositionDetailsPage profile={profile} positionId={positionId} />;
}
