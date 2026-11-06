"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getFeePreview,
  type FeePreviewQuery,
} from "@/services/api/fee-preview";

export default function FeeLine(query: FeePreviewQuery) {
  const { data: fee } = useQuery({
    queryKey: ["fee-preview", query],
    queryFn: () => getFeePreview(query),
    enabled: query.amount > 0 && Boolean(query.chain),
  });

  if (!fee) return null;
  return (
    <div className="flex items-center justify-between text-[11px] text-gray-30 dark:text-gray-40">
      <span>Kellon fee</span>
      <span>
        {fee} {query.asset}
      </span>
    </div>
  );
}
