import { stocksService } from "@/services/api/stocks";

export interface PermitSigner {
  address: string;
  getEthereumProvider: () => Promise<{
    request: (args: { method: string; params: unknown[] }) => Promise<unknown>;
  }>;
}

/** Recover embedded-EOA shares using the backend's permit plan, never a guessed holder. */
export async function sweepStrandedShares(params: {
  signerFor: (address: string) => PermitSigner | undefined;
  smartAccountAddress: string;
  symbol: string;
  provider: string;
  sendCalls: (
    calls: Array<{ to: `0x${string}`; data: `0x${string}`; value: bigint }>,
  ) => Promise<string>;
}): Promise<string> {
  const { signerFor, smartAccountAddress, symbol, provider, sendCalls } =
    params;
  const { data: plan } = await stocksService.planSweep({ symbol, provider });
  const signer = signerFor(plan.from);
  if (!signer || signer.address.toLowerCase() !== plan.from.toLowerCase()) {
    throw new Error(
      `Your ${symbol} is on an address this browser cannot sign for. Please contact support to move it.`,
    );
  }
  if (plan.to.toLowerCase() !== smartAccountAddress.toLowerCase()) {
    throw new Error(
      "The share recovery destination does not match your wallet.",
    );
  }
  if (plan.kind !== "permit" || !plan.typedData || !plan.deadline) {
    throw new Error(
      `Your ${symbol} shares need native gas to move. Please contact support.`,
    );
  }
  const ethereum = await signer.getEthereumProvider();
  const signature = await ethereum.request({
    method: "eth_signTypedData_v4",
    params: [plan.from, JSON.stringify(plan.typedData)],
  });
  if (typeof signature !== "string" || !signature.startsWith("0x")) {
    throw new Error("Share recovery signing failed. Please try again.");
  }
  const { data: execution } = await stocksService.buildSweep({
    symbol,
    provider,
    holder: plan.from,
    amount: plan.amount,
    deadline: plan.deadline,
    signature,
  });
  if (
    execution.to.toLowerCase() !== smartAccountAddress.toLowerCase() ||
    execution.from.toLowerCase() !== plan.from.toLowerCase() ||
    execution.chain !== plan.chain ||
    !execution.calls.length
  ) {
    throw new Error(
      "The share recovery transaction does not match the signed plan.",
    );
  }
  const hash = await sendCalls(
    execution.calls.map((call) => ({
      to: call.to as `0x${string}`,
      data: (call.data || "0x") as `0x${string}`,
      value: BigInt(call.value || "0"),
    })),
  );
  if (!hash?.startsWith("0x"))
    throw new Error("Could not move your shares. Please try again.");
  return hash;
}
