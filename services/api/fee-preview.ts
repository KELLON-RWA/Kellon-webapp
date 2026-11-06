import { apiFetch } from "./index";

export interface FeePreviewQuery {
  feature: "yield" | "stocks";
  moment: string;
  provider?: string;
  chain?: string;
  asset: string;
  amount: number;
}

/** The Kellon fee for this amount. Zero when there is none or it cannot be read. */
export const getFeePreview = async ({
  provider,
  chain,
  amount,
  ...rest
}: FeePreviewQuery): Promise<number> => {
  const query = new URLSearchParams({
    ...rest,
    provider: provider ?? "",
    chain: chain ?? "",
    amount: String(amount),
  });
  const res = await apiFetch(`/system/fee-preview?${query}`);
  if (!res.ok) return 0;
  const body = (await res.json()) as { data?: { total?: string } };
  return Number(body.data?.total ?? 0);
};
