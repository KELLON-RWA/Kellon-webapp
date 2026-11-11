import { parseUnits } from "viem";

/** Base units without going through String(number), which yields "1e-7" for small values. */
export function toBaseUnits(value: number | string, decimals: number): bigint {
  const raw =
    typeof value === "number" ? value.toFixed(decimals) : String(value).trim();
  const [whole, fraction = ""] = raw.split(".");
  return parseUnits(
    `${whole || "0"}.${fraction.slice(0, decimals) || "0"}`,
    decimals,
  );
}

/** A "max" amount may overshoot the on-chain balance by display rounding only. */
export function clampDust(
  requested: bigint,
  balance: bigint,
  decimals: number,
): bigint {
  const dust = 10n ** BigInt(Math.max(decimals - 6, 0));
  return requested > balance && requested - balance <= dust
    ? balance
    : requested;
}

/**
 * Truncates an asset balance down so that clicking MAX never rounds up
 * or overshoots the on-chain balance due to IEEE 754 floating-point precision.
 */
export function formatMaxInputAmount(
  val: number | string | null | undefined,
  maxDecimals: number = 6,
): string {
  if (val === null || val === undefined || val === "") return "0";
  const num = typeof val === "number" ? val : parseFloat(String(val).trim());
  if (!Number.isFinite(num) || num <= 0) return "0";

  // Use toFixed(18) to avoid scientific notation, then truncate without rounding
  const str = typeof val === "number" ? val.toFixed(18) : String(val).trim();
  const [whole, fraction = ""] = str.split(".");
  const truncated = fraction.slice(0, maxDecimals).replace(/0+$/, "");
  return truncated ? `${whole}.${truncated}` : whole;
}
