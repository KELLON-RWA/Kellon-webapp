import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
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

function SendFlowLoading() {
  return (
    <div className="flex min-h-[90dvh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary-50" />
    </div>
  );
}

export default async function SendPage() {
  const profile = (await currentProfile()) as User;

  if (!profile) {
    redirect("/");
  }

  return (
    <div className="min-h-[100dvh]">
      <Suspense fallback={<SendFlowLoading />}>
        <SendFlow profile={profile} />
      </Suspense>
    </div>
  );
}
