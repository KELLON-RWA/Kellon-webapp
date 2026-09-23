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
