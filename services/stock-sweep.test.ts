import { beforeEach, describe, expect, it, vi } from "vitest";
import { stocksService, type StockSweepPlan } from "./api/stocks";
import { sweepStrandedShares } from "./stock-sweep";

vi.mock("./api/stocks", () => ({
  stocksService: { planSweep: vi.fn(), buildSweep: vi.fn() },
}));

const plan: StockSweepPlan = {
  kind: "permit",
  chain: "bnb",
  from: "0xHolder",
  to: "0xSafe",
  amount: "123",
  deadline: "999",
  typedData: { domain: {}, types: {}, primaryType: "Permit", message: {} },
};

describe("stranded share recovery", () => {
  const request = vi.fn();
  const sendCalls = vi.fn();
  const signerFor = vi.fn();
  const recover = () =>
    sweepStrandedShares({
      signerFor,
      sendCalls,
      smartAccountAddress: "0xSafe",
      symbol: "AAPL",
      provider: "bstock",
    });

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(stocksService.planSweep).mockResolvedValue({
      success: true,
      data: plan,
    });
    vi.mocked(stocksService.buildSweep).mockResolvedValue({
      success: true,
      data: {
        chain: "bnb",
        from: "0xHolder",
        to: "0xSafe",
        calls: [{ to: "0xToken", data: "0x123", value: "0" }],
      },
    });
    signerFor.mockReturnValue({
      address: "0xHolder",
      getEthereumProvider: async () => ({ request }),
    });
    request.mockResolvedValue("0xSignature");
    sendCalls.mockResolvedValue("0xHash");
  });

  it("uses the holder, amount and deadline from the backend plan", async () => {
    await expect(recover()).resolves.toBe("0xHash");
    expect(signerFor).toHaveBeenCalledWith("0xHolder");
    expect(request).toHaveBeenCalledWith({
      method: "eth_signTypedData_v4",
      params: ["0xHolder", JSON.stringify(plan.typedData)],
    });
    expect(stocksService.buildSweep).toHaveBeenCalledWith({
      symbol: "AAPL",
      provider: "bstock",
      holder: "0xHolder",
      amount: "123",
      deadline: "999",
      signature: "0xSignature",
    });
    expect(sendCalls).toHaveBeenCalledWith([
      { to: "0xToken", data: "0x123", value: 0n },
    ]);
  });

  it("does not fall back to another signer", async () => {
    signerFor.mockReturnValue(undefined);
    await expect(recover()).rejects.toThrow("cannot sign");
    expect(request).not.toHaveBeenCalled();
    expect(sendCalls).not.toHaveBeenCalled();
  });

  it("rejects a foreign destination before signing", async () => {
    vi.mocked(stocksService.planSweep).mockResolvedValue({
      success: true,
      data: { ...plan, to: "0xForeign" },
    });
    await expect(recover()).rejects.toThrow("destination");
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects unsupported non-permit recovery", async () => {
    vi.mocked(stocksService.planSweep).mockResolvedValue({
      success: true,
      data: { ...plan, kind: "transfer" },
    });
    await expect(recover()).rejects.toThrow("native gas");
    expect(sendCalls).not.toHaveBeenCalled();
  });

  it("rejects an execution that changed the signed holder", async () => {
    vi.mocked(stocksService.buildSweep).mockResolvedValue({
      success: true,
      data: { chain: "bnb", from: "0xOther", to: "0xSafe", calls: [] },
    });
    await expect(recover()).rejects.toThrow("signed plan");
    expect(sendCalls).not.toHaveBeenCalled();
  });
});
