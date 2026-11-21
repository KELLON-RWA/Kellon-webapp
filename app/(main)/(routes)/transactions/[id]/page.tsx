import type { Metadata } from "next";
import { redirect } from "next/navigation";
import TransactionDetailsClient from "@/components/transactions/TransactionDetails";
import { currentProfile } from "@/lib/current-profile";

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
  const profile = await currentProfile();
  if (!profile) redirect("/continue");

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
