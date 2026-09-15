"use client";

import ChainIcon from "@/components/wallet/ChainIcon";
import FlowSummaryPill from "@/components/wallet/shared/FlowSummaryPill";
import { getChainLabel } from "@/lib/chains";
import type { RecipientKind, SendableAsset } from "./send-types";
import {
  formatAssetAmount,
  getRecipientLabel,
  getTokenIconUrl,
  truncateMiddle,
} from "./send-utils";

interface ReviewStepProps {
  amountValue: number;
  selectedAsset: SendableAsset | null;
  recipientInput: string;
  recipientKind: RecipientKind;
}

function ReviewRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
        {label}
      </span>
      {children || (
        <span className="min-w-0 truncate text-right text-sm font-bold text-black dark:text-white">
          {value}
        </span>
      )}
    </div>
  );
}

export default function ReviewStep({
  amountValue,
  selectedAsset,
  recipientInput,
  recipientKind,
}: ReviewStepProps) {
  const networkName = getChainLabel(selectedAsset?.chain);
  const assetSymbol = selectedAsset?.symbol || "--";

  return (
    <div className="flex h-full flex-col">
      <FlowSummaryPill
        asset={selectedAsset?.symbol || null}
        assetIconUrl={
          selectedAsset ? getTokenIconUrl(selectedAsset.symbol) : null
        }
        networkName={networkName}
        amount={formatAssetAmount(amountValue)}
        amountCurrency={selectedAsset?.symbol}
      />

      <section className="w-full rounded-[28px] border border-black/5 bg-white p-6 dark:border-white/10 dark:bg-secondary-50">
        <div className="space-y-5">
          <ReviewRow
            label="Send amount"
            value={`${formatAssetAmount(amountValue)} ${assetSymbol}`}
          />
          <div className="h-px w-full bg-slate-200 dark:bg-white/5" />
          <ReviewRow
            label="Recipient"
            value={truncateMiddle(recipientInput.trim(), 20)}
          />
          <ReviewRow label="Method" value={getRecipientLabel(recipientKind)} />
          <ReviewRow label="Asset" value={assetSymbol} />
          <ReviewRow label="Blockchain">
            <span className="flex min-w-0 items-center gap-2 text-right text-sm font-bold text-black dark:text-white">
              {selectedAsset?.chain ? (
                <ChainIcon name={selectedAsset.chain} size={16} />
              ) : null}
              <span className="truncate">{networkName}</span>
            </span>
          </ReviewRow>
        </div>
      </section>
    </div>
  );
}
