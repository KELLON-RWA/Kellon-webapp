import type { ReactNode } from "react";
import { ArrowRight, Clock3 } from "lucide-react";
import FlowActionFooter from "@/components/wallet/shared/FlowActionFooter";
import type { BridgeAssetOption } from "@/lib/bridge-assets";
import type { BridgeRateOption } from "@/services/api/bridge";
import { BRIDGE_CARD_CLASS } from "../constants";
import {
  formatBridgeBalance,
  formatBridgeDuration,
  getRouteAggregator,
  getRouteDuration,
  getRouteFee,
  getRouteProvider,
  getRouteReceiveAmount,
} from "../utils";

interface BridgeReviewStepProps {
  source: BridgeAssetOption;
  destination: BridgeAssetOption;
  amount: number;
  route: BridgeRateOption;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export function BridgeReviewStep({
  source,
  destination,
  amount,
  route,
  isSubmitting,
  onSubmit,
}: BridgeReviewStepProps) {
  const receive = getRouteReceiveAmount(route);
  const fee = getRouteFee(route);
  const duration = getRouteDuration(route);

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <section className={BRIDGE_CARD_CLASS}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-secondary-50">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              You send
            </p>
            <p className="mt-1 text-2xl font-bold text-black dark:text-white">
              {formatBridgeBalance(amount)} {source.symbol}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              on {source.chainName}
            </p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-primary-60" />
          <div className="min-w-0 text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              You receive
            </p>
            <p className="mt-1 text-2xl font-bold text-primary-60">
              ≈ {formatBridgeBalance(receive)} {destination.symbol}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              on {destination.chainName}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-black/5 bg-white px-4 dark:border-white/10 dark:bg-secondary-50">
          <PreviewRow label="From" value={source.chainName} />
          <PreviewRow label="To" value={destination.chainName} />
          <PreviewRow
            label="You send"
            value={`${formatBridgeBalance(amount)} ${source.symbol}`}
          />
          <PreviewRow
            label="You receive"
            value={`≈ ${formatBridgeBalance(receive)} ${destination.symbol}`}
          />
          {route.messengerName ? (
            <PreviewRow label="Protocol" value={getRouteProvider(route)} />
          ) : null}
          <PreviewRow label="Aggregator" value={getRouteAggregator(route)} />
          <PreviewRow
            label="Estimated fee"
            value={`≈ ${formatBridgeBalance(fee)} ${source.symbol}`}
          />
          {duration > 0 ? (
            <PreviewRow
              label="Estimated time"
              value={formatBridgeDuration(duration)}
              icon={<Clock3 className="h-3.5 w-3.5" />}
            />
          ) : null}
        </div>
      </section>

      <FlowActionFooter
        sticky={false}
        onClick={onSubmit}
        disabled={isSubmitting}
        helperText="Confirm the route and amounts before signing."
      >
        {isSubmitting ? "Submitting…" : "Start bridging"}
        <ArrowRight className="h-4 w-4" />
      </FlowActionFooter>
    </div>
  );
}

function PreviewRow({
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
