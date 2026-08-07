import type { Metadata } from "next";
import TransactionDetailsClient from "@/components/transactions/TransactionDetails";

interface TransactionDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export const metadata: Metadata = {
  title: "Transaction Details",
  description:
    "View the details of a specific Kellon transaction and generate a shareable receipt.",
};

export default async function TransactionDetailsPage({
  params,
}: TransactionDetailsPageProps) {
  const { id } = await params;

  return (
    <div className="min-h-[100dvh]">
      <TransactionDetailsClient id={id} />
    </div>
  );
}
