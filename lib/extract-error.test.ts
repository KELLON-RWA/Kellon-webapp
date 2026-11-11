import { describe, expect, it } from "vitest";
import { decodeRevertReason, extractHumanErrorMessage } from "./utils";

describe("error message extraction", () => {
  it("decodes standard EVM revert reason strings", () => {
    // 0x08c379a0 selector followed by ABI-encoded string "TRANSFER_FAILED"
    const hex =
      "0x08c379a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000f5452414e534645525f4641494c45440000000000000000000000000000000000";
    expect(decodeRevertReason(hex)).toBe("TRANSFER_FAILED");
  });

  it("extracts friendly balance message when token balance is exceeded", () => {
    const error = new Error(
      "An error occurred while executing user operation: execution reverted: transfer amount exceeds balance",
    );
    expect(extractHumanErrorMessage(error)).toBe(
      "Insufficient token balance to complete this transaction.",
    );
  });

  it("extracts friendly message when paymaster sponsorship fails", () => {
    const error = new Error("AA31 paymaster deposit too low");
    expect(extractHumanErrorMessage(error)).toBe(
      "Transaction sponsorship is temporarily busy. Please try again shortly.",
    );
  });

  it("extracts friendly message when quote or price shifts", () => {
    const error = new Error(
      "Step simulation failed: InsufficientOutput() at UniswapV3 router",
    );
    expect(extractHumanErrorMessage(error)).toBe(
      "The quote or price shifted during confirmation. Please review the updated route and try again.",
    );
  });

  it("cleans raw calldata hex dumps from viem execution errors", () => {
    const error = new Error(
      "An error occurred while executing user operation: An unknown RPC error occurred.\nRequest Arguments: callData: 0x541d63cb0000000000000000000000009641d7641c13c8b624c04430c7356c1c7c8102e20000000000000000000000000000000000000000000000000000000000000000",
    );
    const msg = extractHumanErrorMessage(error);
    expect(msg).not.toContain("0x541d63cb");
    expect(msg).not.toContain("Request Arguments:");
  });
});
