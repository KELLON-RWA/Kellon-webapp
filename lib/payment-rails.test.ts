import { describe, expect, it } from "vitest"
import {
  ACTIVE_PAYMENT_RAIL,
  getPaymentRailConfig,
} from "./payment-rails"

describe("payment rail copy", () => {
  it("locks the currently available rail to bank transfer", () => {
    expect(ACTIVE_PAYMENT_RAIL).toBe("bank_transfer")
    expect(getPaymentRailConfig(ACTIVE_PAYMENT_RAIL)).toMatchObject({
      apiValue: "bank",
      label: "Bank Transfer",
      depositAction: "Get Transfer Details",
      withdrawalAction: "Confirm Withdrawal",
    })
  })

  it("keeps future card and mobile-money copy ready", () => {
    expect(getPaymentRailConfig("card").depositAction).toBe(
      "Continue to Card Payment",
    )
    expect(getPaymentRailConfig("mobile_money").depositAction).toBe(
      "Continue to Mobile Money",
    )
  })
})
