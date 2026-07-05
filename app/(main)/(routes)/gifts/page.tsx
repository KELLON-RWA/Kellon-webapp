import type { Metadata } from "next";
import { redirect } from "next/navigation";
import GiftFlow from "@/components/gifts/GiftFlow";
import { currentProfile } from "@/lib/current-profile";
import type { User } from "@/types/db";

export const metadata: Metadata = {
  title: "Crypto Gifts",
  description: "Send crypto gift cards to friends and Kellon users.",
  alternates: {
    canonical: "/gifts",
  },
};

export default async function GiftsPage() {
  const profile = (await currentProfile()) as User;

  if (!profile) {
    redirect("/");
  }

  return (
    <main className="min-h-[100dvh]">
      <GiftFlow profile={profile} />
    </main>
  );
}
