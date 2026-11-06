import { apiFetch } from "./index";
import { getCachedApiResponse } from "./cache";

const SWAP_FEE_TTL = 60_000;

/** The admin-managed LI.FI fee as a ratio. A swap is not blocked if it cannot be read. */
export const getSwapFee = (): Promise<number> =>
  getCachedApiResponse("system:swap-fee", SWAP_FEE_TTL, async () => {
    const res = await apiFetch("/system/swap-fee");
    if (!res.ok) throw new Error("Failed to load the swap fee");
    const body = (await res.json()) as { data?: { fee?: number } };
    return body.data?.fee ?? 0;
  }).catch(() => 0);
