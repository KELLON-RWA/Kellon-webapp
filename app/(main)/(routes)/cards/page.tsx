import type { Metadata } from "next";
import VirtualCardsPage from "@/components/cards/VirtualCardsPage";
import { currentProfile } from "@/lib/current-profile";
import type { User } from "@/types/db";

export const metadata: Metadata = {
  title: "Cards",
  description:
    "Manage your Kellon cards and spending tools from one secure place.",
  alternates: {
    canonical: "/cards",
  },
};

const page = async () => {
  const profile = (await currentProfile()) as User;
  return <VirtualCardsPage profile={profile} />;
};

export default page;
