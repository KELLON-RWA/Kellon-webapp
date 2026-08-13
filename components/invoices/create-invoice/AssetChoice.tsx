import TokenChoice from "@/components/wallet/shared/TokenChoice";
import type { InvoiceAssetGroup } from "./types";

interface AssetChoiceProps {
  asset: InvoiceAssetGroup;
  selected: boolean;
  onClick: () => void;
}

export function AssetChoice({ asset, selected, onClick }: AssetChoiceProps) {
  return (
    <TokenChoice
      symbol={asset.symbol}
      name={asset.name}
      iconUrl={asset.iconUrl}
      selected={selected}
      onClick={onClick}
    />
  );
}
