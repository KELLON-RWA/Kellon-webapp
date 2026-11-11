import { redirect } from "next/navigation";

interface ConvertPageProps {
  searchParams: Promise<{
    asset?: string;
    network?: string;
    mode?: "swap" | "bridge" | "auto";
  }>;
}

export default async function ConvertPage({ searchParams }: ConvertPageProps) {
  const params = await searchParams;
  const search = new URLSearchParams(
    Object.entries(params || {}).filter(([, v]) => typeof v === "string" && v.length > 0) as [string, string][]
  ).toString();

  redirect(`/bridge${search ? `?${search}` : ""}`);
}
