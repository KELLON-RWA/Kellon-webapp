import type { LiFiStep, Route, RoutesRequest, Token } from "@lifi/sdk";

type SwapErrorBody = { message?: string; error?: string };

async function localSwapRequest<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as SwapErrorBody &
    T;
  if (!response.ok) {
    throw new Error(
      payload.message || payload.error || "Swap service is unavailable",
    );
  }
  return payload;
}

export const swapService = {
  getTokens: async () => {
    const response = await fetch("/api/swap/tokens", { cache: "no-store" });
    const payload = (await response
      .json()
      .catch(() => ({}))) as SwapErrorBody & {
      tokens: Token[];
    };
    if (!response.ok) {
      throw new Error(
        payload.message || payload.error || "Unable to load swap tokens",
      );
    }
    return payload.tokens;
  },
  getRoutes: (request: RoutesRequest) =>
    localSwapRequest<{ routes: Route[] }>("/api/swap/routes", request),
  getStepTransaction: (step: LiFiStep) =>
    localSwapRequest<{ step: LiFiStep }>("/api/swap/transaction", { step }),
};

export type { LiFiStep, Route, RoutesRequest, Token };
