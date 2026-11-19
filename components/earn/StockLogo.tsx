"use client";

import Image from "next/image";
import { useState } from "react";

export default function StockLogo({
  symbol,
  logoUrl,
  size = 36,
}: {
  symbol: string;
  logoUrl?: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (!logoUrl || failed) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-primary-90/10 text-[10px] font-bold uppercase text-primary-90 dark:bg-primary-70/20 dark:text-primary-30"
        style={{ width: size, height: size }}
      >
        {symbol.slice(0, 2)}
      </span>
    );
  }

  return (
    <Image
      src={logoUrl}
      alt={`${symbol} logo`}
      width={size}
      height={size}
      className="shrink-0 rounded-full"
      onError={() => setFailed(true)}
    />
  );
}
