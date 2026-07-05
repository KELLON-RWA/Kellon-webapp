import { cn } from "@/lib/utils";
import FlowSummaryPill from "@/components/wallet/shared/FlowSummaryPill";
import { FlowReviewRow } from "@/components/wallet/shared/FlowReviewRow";
import type { TransferRecipient } from "@/services/api/transfers";
import {
  EXPIRY_PRESETS,
  INVOICE_CARD_CLASS,
  type InvoiceAssetOption,
  type InvoiceFormValues,
} from "./types";
import { formatChain, getExpiryDate } from "./utils";

interface InvoiceReviewProps {
  selectedAsset?: InvoiceAssetOption;
  selectedAssetSymbol: string;
  watchedAmount: string;
  watchedDescription?: string;
  watchedExpiryPreset: InvoiceFormValues["expiryPreset"];
  selectedExpiry?: (typeof EXPIRY_PRESETS)[number];
  verifiedCustomer: TransferRecipient | null;
  customerContactValue: string;
  customerContactLabel: string;
}

export function InvoiceReview({
  selectedAsset,
  selectedAssetSymbol,
  watchedAmount,
  watchedDescription,
  watchedExpiryPreset,
  selectedExpiry,
  verifiedCustomer,
  customerContactValue,
  customerContactLabel,
}: InvoiceReviewProps) {
  return (
    <div className="mx-auto w-full max-w-xl animate-in fade-in slide-in-from-bottom-4">
      <FlowSummaryPill
        asset={selectedAsset?.symbol || selectedAssetSymbol || null}
        assetIconUrl={selectedAsset?.iconUrl}
        networkName={selectedAsset ? formatChain(selectedAsset.chain) : null}
        amount={watchedAmount || "0"}
        amountCurrency={selectedAsset?.symbol}
      />

      <section className={cn(INVOICE_CARD_CLASS, "p-6")}>
        <div className="space-y-4">
          <FlowReviewRow
            label="Amount"
            value={`${watchedAmount || "0"} ${selectedAsset?.symbol || ""}`}
            highlight
          />
          <FlowReviewRow
            label="Network"
            value={selectedAsset ? formatChain(selectedAsset.chain) : "--"}
          />
          <FlowReviewRow
            label="Customer"
            value={verifiedCustomer?.name || "Verified customer"}
          />
          <FlowReviewRow
            label={customerContactLabel}
            value={customerContactValue || "--"}
          />
          <FlowReviewRow
            label="Description"
            value={watchedDescription?.trim() || "No description"}
          />
          <FlowReviewRow
            label="Expires"
            value={`${selectedExpiry?.label || "1 Day"} • ${getExpiryDate(
              watchedExpiryPreset,
            ).toLocaleDateString()}`}
          />
        </div>
      </section>
    </div>
  );
}
