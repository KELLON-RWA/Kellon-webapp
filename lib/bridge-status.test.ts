import { describe, expect, it } from "vitest";
import { isTerminalBridgeFailure } from "./bridge-status";

describe("isTerminalBridgeFailure", () => {
  it("keeps retrying pending destination failures", () => {
    expect(
      isTerminalBridgeFailure({
        status: "PENDING",
        substatus: "DESTINATION_EXECUTION_FAILED",
      }),
    ).toBe(false);
    expect(
      isTerminalBridgeFailure({
        status: "PENDING",
        substatus: "ATTESTATION_EXPIRED",
      }),
    ).toBe(false);
    expect(isTerminalBridgeFailure({ status: "UNKNOWN" })).toBe(false);
  });

  it("ends recovery for verified terminal outcomes", () => {
    for (const status of ["FAILED", "REFUNDED", "CANCELLED", "EXPIRED"]) {
      expect(isTerminalBridgeFailure({ status })).toBe(true);
    }
  });
});
