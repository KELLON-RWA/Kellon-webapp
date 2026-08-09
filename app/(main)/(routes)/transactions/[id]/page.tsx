import type { Metadata } from "next";
import TransactionDetailsClient from "@/components/transactions/TransactionDetails";

interface TransactionDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    origin?: string | string[];
  }>;
}

export const metadata: Metadata = {
  title: "Transaction Details",
  description:
    "View the details of a specific Kellon transaction and generate a shareable receipt.",
};

export default async function TransactionDetailsPage({
  params,
  searchParams,
}: TransactionDetailsPageProps) {
  const { id } = await params;
  const { origin } = await searchParams;

  return (
    <div className="min-h-[100dvh]">
      <TransactionDetailsClient
        id={id}
        origin={Array.isArray(origin) ? origin[0] : origin}
      />
    </div>
  );
}
