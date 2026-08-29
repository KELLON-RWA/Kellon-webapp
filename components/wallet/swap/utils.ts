import { formatUnits } from "viem";
import type { Route } from "@/services/api/swap";

export function formatSwapAmount(
  value: number | string,
  maximumFractionDigits = 6,
) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(
    amount,
  );
}

export function getRouteReceiveAmount(route?: Route | null) {
  if (!route) return 0;
  return Number(formatUnits(BigInt(route.toAmount), route.toToken.decimals));
}

export function getRouteMinimumAmount(route: Route) {
  return Number(formatUnits(BigInt(route.toAmountMin), route.toToken.decimals));
}

export function getRouteDuration(route: Route) {
  return route.steps.reduce(
    (total, step) => total + (step.estimate.executionDuration || 0),
    0,
  );
}

export function getRouteProvider(route: Route) {
  return (
    [...new Set(route.steps.map((step) => step.toolDetails.name))].join(
      " + ",
    ) || "LI.FI"
  );
}

export function getRouteFeeUsd(route: Route) {
  const feeCosts = route.steps.flatMap((step) => step.estimate.feeCosts || []);
  return (
    Number(route.gasCostUSD || 0) +
    feeCosts.reduce((total, fee) => total + Number(fee.amountUSD || 0), 0)
  );
}

export function formatDuration(seconds: number) {
  if (seconds < 60) return `About ${Math.max(1, Math.ceil(seconds))} sec`;
  return `About ${Math.ceil(seconds / 60)} min`;
}

export function getTokenIcon(symbol: string) {
  return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${symbol.toLowerCase()}.png`;
}
