import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { User } from "@/types/db";
import { currentProfile } from "@/lib/current-profile";
import SendFlow from "@/components/wallet/send/SendFlow";

export const metadata: Metadata = {
  title: "Send",
  description:
    "Send supported digital assets from your Kellon wallet to another user.",
  alternates: {
    canonical: "/send",
  },
};

export default async function SendPage() {
  const profile = (await currentProfile()) as User;

  if (!profile) {
    redirect("/");
  }

  return (
    <div className="min-h-[100dvh]">
      <SendFlow profile={profile} />
    </div>
  );
}
