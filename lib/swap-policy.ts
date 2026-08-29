import { getActiveChains } from "./chains";

export const NATIVE_TOKEN_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000000",
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
]);

export const STABLE_SWAP_SYMBOLS = new Set(["USDC", "USDT"]);

export function isNativeSwapAddress(address?: string | null) {
  return Boolean(address && NATIVE_TOKEN_ADDRESSES.has(address.toLowerCase()));
}

export function isStableSwapToken(
  chainId: number,
  address: string,
  symbol?: string,
) {
  if (symbol && !STABLE_SWAP_SYMBOLS.has(symbol.toUpperCase())) return false;
  const chain = Object.values(getActiveChains()).find(
    (candidate) =>
      candidate.type === "evm" && Number(candidate.id) === Number(chainId),
  );
  if (!chain) return false;
  const supportedAddresses = [chain.usdcAddress, chain.usdtAddress]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  return supportedAddresses.includes(address.toLowerCase());
}

export function isNativeToStableSwap(input: {
  fromChainId: number;
  toChainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
}) {
  return (
    input.fromChainId === input.toChainId &&
    isNativeSwapAddress(input.fromTokenAddress) &&
    isStableSwapToken(input.toChainId, input.toTokenAddress)
  );
}
