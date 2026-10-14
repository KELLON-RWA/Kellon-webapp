import type { Metadata } from "next";
import NotificationsPage from "@/components/notification/NotificationsPage";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Stay up to date with your Kellon account activity and alerts.",
  alternates: {
    canonical: "/notifications",
  },
};

export default async function page({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  return (
    <div className="min-h-[100dvh]">
      <NotificationsPage
        initialCategory={category === "system" ? "System" : "All"}
      />
    </div>
  );
}
