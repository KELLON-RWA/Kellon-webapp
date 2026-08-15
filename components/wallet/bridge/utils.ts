import type {
  BridgeRateOption,
  BridgeRecommendation,
} from "@/services/api/bridge";

export function formatBridgeBalance(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(
    value,
  );
}

export function formatBridgeDuration(seconds: number): string {
  if (seconds < 60) return `About ${Math.max(1, Math.ceil(seconds))} sec`;
  return `About ${Math.ceil(seconds / 60)} min`;
}

export function getRouteId(route?: BridgeRateOption | null): string {
  return route ? `${route.provider}:${route.messenger || "default"}` : "";
}

export function getRouteDuration(route: BridgeRateOption): number {
  return route.executionDuration || route.estimatedTime || 0;
}

export function getRouteReceiveAmount(route: BridgeRateOption): number {
  const amount = Number(route.estimatedOutput || 0);
  return Number.isFinite(amount) ? amount : 0;
}

export function getRouteProvider(route: BridgeRateOption): string {
  return route.messengerName || getRouteAggregator(route);
}

export function getRouteAggregator(route: BridgeRateOption): string {
  return route.provider === "lifi" ? "LI.FI" : "Allbridge";
}

export function getRouteFee(route: BridgeRateOption): number {
  const fee = Number(route.estimatedFee || 0);
  return Number.isFinite(fee) ? Math.max(0, fee) : 0;
}

export function matchesBridgeRecommendation(
  route: BridgeRateOption,
  recommendation?: BridgeRecommendation,
): boolean {
  if (!recommendation || route.provider !== recommendation.provider) {
    return false;
  }
  return recommendation.messenger
    ? route.messenger === recommendation.messenger
    : true;
}

export function getBridgeTokenIcon(symbol: string): string {
  return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`;
}
