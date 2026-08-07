import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { User } from "@/types/db";
import { currentProfile } from "@/lib/current-profile";
import CreateInvoicePage from "@/components/invoices/CreateInvoicePage";

export const metadata: Metadata = {
  title: "Create Invoice",
  description: "Create a Kellon payment request for a customer.",
  alternates: {
    canonical: "/invoices/create",
  },
};

export default async function CreateInvoiceRoutePage() {
  const profile = (await currentProfile()) as User;

  if (!profile) {
    redirect("/");
  }

  return (
    <div className="min-h-[100dvh]">
      <CreateInvoicePage profile={profile} />
    </div>
  );
}
