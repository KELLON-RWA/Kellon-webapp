export type PaymentRail = "bank_transfer" | "card" | "mobile_money"

interface PaymentRailConfig {
  apiValue: "bank" | "card" | "mobile_money"
  label: string
  depositAction: string
  depositLoadingAction: string
  depositHelperText: string
  withdrawalAction: string
  withdrawalLoadingAction: string
}

export const ACTIVE_PAYMENT_RAIL: PaymentRail = "bank_transfer"

const PAYMENT_RAIL_CONFIG: Record<PaymentRail, PaymentRailConfig> = {
  bank_transfer: {
    apiValue: "bank",
    label: "Bank Transfer",
    depositAction: "Get Transfer Details",
    depositLoadingAction: "Preparing Transfer Details...",
    depositHelperText:
      "You will receive the bank account details needed to complete this transfer.",
    withdrawalAction: "Confirm Withdrawal",
    withdrawalLoadingAction: "Processing Withdrawal...",
  },
  card: {
    apiValue: "card",
    label: "Debit/Credit Card",
    depositAction: "Continue to Card Payment",
    depositLoadingAction: "Opening Card Payment...",
    depositHelperText:
      "You will continue to the provider's secure card payment page.",
    withdrawalAction: "Confirm Withdrawal",
    withdrawalLoadingAction: "Processing Withdrawal...",
  },
  mobile_money: {
    apiValue: "mobile_money",
    label: "Mobile Money",
    depositAction: "Continue to Mobile Money",
    depositLoadingAction: "Opening Mobile Money...",
    depositHelperText:
      "You will continue to the provider's mobile money payment flow.",
    withdrawalAction: "Confirm Withdrawal",
    withdrawalLoadingAction: "Processing Withdrawal...",
  },
}

export function getPaymentRailConfig(rail: PaymentRail): PaymentRailConfig {
  return PAYMENT_RAIL_CONFIG[rail]
}
