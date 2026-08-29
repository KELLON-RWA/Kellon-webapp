import type { ReactNode } from "react";
import { ArrowRight, Clock3 } from "lucide-react";
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter";
import type { SwapAssetOption } from "@/lib/swap-assets";
import type { Route } from "@/services/api/swap";
import { SWAP_CARD_CLASS } from "../constants";
import {
  formatDuration,
  formatSwapAmount,
  getRouteDuration,
  getRouteFeeUsd,
  getRouteMinimumAmount,
  getRouteProvider,
  getRouteReceiveAmount,
} from "../utils";

interface Props {
  source: SwapAssetOption;
  destination: SwapAssetOption;
  amount: number;
  route: Route;
  isSubmitting: boolean;
  onSubmit: () => void;
}
export function SwapReviewStep({
  source,
  destination,
  amount,
  route,
  isSubmitting,
  onSubmit,
}: Props) {
  const duration = getRouteDuration(route);
  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <section className={SWAP_CARD_CLASS}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-secondary-50">
          <div className="min-w-0">
            <p className="text-xs text-gray-500">You send</p>
            <p className="mt-1 text-2xl font-bold text-black dark:text-white">
              {formatSwapAmount(amount)} {source.symbol}
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-primary-60" />
          <div className="min-w-0 text-right">
            <p className="text-xs text-gray-500">You receive</p>
            <p className="mt-1 text-2xl font-bold text-primary-60">
              ≈ {formatSwapAmount(getRouteReceiveAmount(route))}{" "}
              {destination.symbol}
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-black/5 bg-white px-4 dark:border-white/10 dark:bg-secondary-50">
          <Row label="Network" value={source.chainName} />
          <Row label="Provider" value={getRouteProvider(route)} />
          <Row
            label="Minimum received"
            value={`${formatSwapAmount(getRouteMinimumAmount(route))} ${destination.symbol}`}
          />
          <Row
            label="Network cost"
            value={`≈ $${formatSwapAmount(getRouteFeeUsd(route), 2)}`}
          />
          {duration > 0 ? (
            <Row
              label="Estimated time"
              value={formatDuration(duration)}
              icon={<Clock3 className="h-3.5 w-3.5" />}
            />
          ) : null}
        </div>
      </section>
      <FlowActionFooter
        sticky={false}
        onClick={onSubmit}
        disabled={isSubmitting}
        helperText="Confirm the amounts and route before signing."
      >
        {isSubmitting ? "Submitting…" : "Confirm swap"}
        <ArrowRight className="h-4 w-4" />
      </FlowActionFooter>
    </div>
  );
}
function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-black/5 py-3 last:border-0 dark:border-white/10">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="flex items-center gap-1 text-right text-xs font-semibold text-black dark:text-white">
        {icon}
        {value}
      </span>
    </div>
  );
}
