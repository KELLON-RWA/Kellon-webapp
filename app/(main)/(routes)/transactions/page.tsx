import type { Metadata } from "next";
import { redirect } from "next/navigation";
import TransactionsPage from "@/components/transactions/TransactionsPage";
import { currentProfile } from "@/lib/current-profile";

export const metadata: Metadata = {
  title: "Transactions",
  description:
    "Review your Kellon transaction history, filter activity, and track wallet movements.",
  alternates: {
    canonical: "/transactions",
  },
};

export default async function page() {
  const profile = await currentProfile();
  if (!profile) redirect("/continue");

  return (
    <div className="min-h-[100dvh]">
      <TransactionsPage />
    </div>
  );
}
