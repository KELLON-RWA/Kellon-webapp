"use client";

import AssetNetworkIcon from "@/components/wallet/AssetNetworkIcon";
import { cn } from "@/lib/utils";
import type { GiftTemplate } from "./gift-utils";

interface GiftCardPreviewProps {
  template: GiftTemplate;
  amount: string;
  symbol: string;
  recipient: string;
  title?: string;
  fromLabel?: string;
  className?: string;
}

export default function GiftCardPreview({
  template,
  amount,
  symbol,
  recipient,
  title,
  fromLabel = "You",
  className,
}: GiftCardPreviewProps) {
  return (
    <div
      className={cn(
        "relative aspect-[1.58/1] min-h-[210px] overflow-hidden rounded-[28px] bg-gradient-to-br p-6 shadow-xl md:min-h-0 md:p-7",
        template.gradient,
        template.textClassName,
        className,
      )}
    >
      <div className="relative z-10 flex items-start justify-between gap-4">
        <p className="text-xs font-bold uppercase tracking-[0.22em] opacity-80">
          {title?.trim() || "Gift Card"}
        </p>
        <AssetNetworkIcon symbol={symbol || "USDC"} size="sm" />
      </div>

      <div className="relative z-10 mt-12 md:mt-16">
        <p className="text-4xl font-bold tracking-tight md:text-5xl">
          ${amount || "0.00"}
        </p>
        <p className="mt-1 text-lg font-bold">{symbol || "USDC"}</p>
      </div>

      <div className="relative z-10 mt-12 grid grid-cols-2 gap-4 md:mt-14">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-70">
            To
          </p>
          <p className="mt-2 truncate text-lg font-bold">
            {recipient || "Recipient"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-70">
            From
          </p>
          <p className="mt-2 truncate text-lg font-bold">{fromLabel}</p>
        </div>
      </div>

      <div className="pointer-events-none absolute -bottom-14 -right-10 h-36 w-36 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute bottom-2 right-0 h-24 w-24 rotate-[-28deg] border-l-[24px] border-t-[24px] border-white/20" />
    </div>
  );
}
