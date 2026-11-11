import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { SUPPORTED_RAMP_COUNTRIES } from "./supported-countries";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

let cachedCountry: string | null = null;
let pendingCountryDetection: Promise<string> | null = null;

export const detectUserCountry = async (): Promise<string> => {
  if (cachedCountry) return cachedCountry;

  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem("kellon_detected_country");
      if (stored && SUPPORTED_RAMP_COUNTRIES.includes(stored)) {
        cachedCountry = stored;
        return stored;
      }
    } catch {
      // Ignore storage access errors
    }
  }

  if (pendingCountryDetection) {
    return pendingCountryDetection;
  }

  pendingCountryDetection = (async () => {
    try {
      const response = await fetch(`/api/geo`, {
        cache: "default",
      });
      if (response.ok) {
        const data = await response.json();
        const detectedCountry = (data.country_code || data.country || "")
          .toString()
          .toUpperCase();

        if (detectedCountry && SUPPORTED_RAMP_COUNTRIES.includes(detectedCountry)) {
          cachedCountry = detectedCountry;
          if (typeof window !== "undefined") {
            try {
              sessionStorage.setItem("kellon_detected_country", detectedCountry);
            } catch {
              // Ignore storage errors
            }
          }
          return detectedCountry;
        }
      }
    } catch (error) {
      console.error("GeoIP detection failed", error);
    } finally {
      pendingCountryDetection = null;
    }

    return "NG"; // Global fallback set to Nigeria
  })();

  return pendingCountryDetection;
};

export function decodeRevertReason(hex: string): string | null {
  if (!hex.startsWith("0x08c379a0")) return null;
  try {
    const data = hex.slice(10);
    const offset = parseInt(data.slice(0, 64), 16);
    const length = parseInt(data.slice(offset * 2, offset * 2 + 64), 16);
    const msgHex = data.slice(offset * 2 + 64, offset * 2 + 64 + length * 2);
    let result = "";
    for (let i = 0; i < msgHex.length; i += 2) {
      result += String.fromCharCode(parseInt(msgHex.slice(i, i + 2), 16));
    }
    return result;
  } catch {
    return null;
  }
}

export function extractHumanErrorMessage(error: unknown): string {
  if (!error) return "An unexpected error occurred.";
  if (typeof error === "string") return error;

  const err = error as {
    shortMessage?: string;
    details?: string;
    message?: string;
    data?: unknown;
    cause?: unknown;
  };

  // 1. Check for EVM revert string (0x08c379a0) in message, details, or data
  const rawText = `${err.message || ""} ${err.details || ""} ${
    typeof err.data === "string" ? err.data : ""
  }`;
  const hexMatch = rawText.match(/0x08c379a0[0-9a-fA-F]+/);
  if (hexMatch) {
    const decoded = decodeRevertReason(hexMatch[0]);
    if (decoded) return decoded;
  }

  const lower = rawText.toLowerCase();

  // 2. Common balance errors
  if (
    lower.includes("transfer amount exceeds balance") ||
    lower.includes("insufficient balance") ||
    lower.includes("exceeds balance") ||
    lower.includes("erc20: insufficient")
  ) {
    return "Insufficient token balance to complete this transaction.";
  }

  // 3. Bundler & Paymaster sponsorship errors
  if (
    lower.includes("aa21") ||
    lower.includes("didn't pay prefund") ||
    lower.includes("paymaster deposit too low") ||
    lower.includes("aa31") ||
    lower.includes("paymaster not sponsored")
  ) {
    return "Transaction sponsorship is temporarily busy. Please try again shortly.";
  }

  // 4. Slippage & DEX solver issues
  if (
    lower.includes("insufficient output") ||
    lower.includes("insufficientoutput") ||
    lower.includes("slippage") ||
    lower.includes("price movement") ||
    lower.includes("expired")
  ) {
    return "The quote or price shifted during confirmation. Please review the updated route and try again.";
  }

  // 5. User cancellation
  if (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("rejected the request")
  ) {
    return "Transaction was cancelled.";
  }

  // 6. If details is informative and doesn't dump raw hex calldata, use it
  if (
    err.details &&
    !err.details.includes("callData:") &&
    !err.details.includes("0x541d") &&
    err.details.length < 180
  ) {
    return err.details;
  }

  // 7. Clean up standard viem messages (strip "Request Arguments: callData: ..." and stack info)
  if (err.shortMessage && err.shortMessage !== "An unknown RPC error occurred.") {
    return err.shortMessage;
  }

  if (err.message) {
    const cleanMsg = err.message
      .split("Request Arguments:")[0]
      .split("\n")[0]
      .trim();
    if (cleanMsg && cleanMsg !== "An unknown RPC error occurred.") {
      return cleanMsg;
    }
  }

  return "Transaction simulation failed. Please check your balance and try again.";
}
