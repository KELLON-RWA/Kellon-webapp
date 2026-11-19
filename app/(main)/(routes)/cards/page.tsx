import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CardsPage from "@/components/cards/CardsPage";
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

export default async function CardsRoute() {
  const profile = (await currentProfile()) as User;

  if (!profile) {
    redirect("/");
  }

  return <CardsPage profile={profile} />;
}
