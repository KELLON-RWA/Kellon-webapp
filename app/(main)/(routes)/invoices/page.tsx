import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { User } from "@/types/db";
import { currentProfile } from "@/lib/current-profile";
import InvoicesPage from "@/components/invoices/InvoicesPage";

export const metadata: Metadata = {
  title: "Invoices",
  description:
    "Create, manage, and share Kellon payment requests with customers.",
  alternates: {
    canonical: "/invoices",
  },
};

export default async function InvoicesRoutePage() {
  const profile = (await currentProfile()) as User;

  if (!profile) {
    redirect("/");
  }

  return (
    <div className="min-h-[100dvh]">
      <InvoicesPage />
    </div>
  );
}
