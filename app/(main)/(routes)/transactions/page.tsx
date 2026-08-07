import type { Metadata } from "next";
import TransactionsPage from "@/components/transactions/TransactionsPage";

export const metadata: Metadata = {
  title: "Transactions",
  description:
    "Review your Kellon transaction history, filter activity, and track wallet movements.",
  alternates: {
    canonical: "/transactions",
  },
};

export default async function page() {
  return (
    <div className="min-h-[100dvh]">
      <TransactionsPage />
    </div>
  );
}
