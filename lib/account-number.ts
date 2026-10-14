export interface AccountNumberRule {
  min: number;
  max: number;
  placeholder: string;
  tooShort: string;
}

/** Nigerian NUBANs are exactly 10 digits; elsewhere lengths vary by bank (Kenya issues up to 13 and more). */
export function accountNumberRule(currency?: string | null): AccountNumberRule {
  if ((currency || "NGN").toUpperCase() === "NGN") {
    return {
      min: 10,
      max: 10,
      placeholder: "Enter 10-digit account number",
      tooShort: "Account number must be exactly 10 digits.",
    };
  }
  return {
    min: 6,
    max: 16,
    placeholder: "Enter account number",
    tooShort: "Account number must be at least 6 digits.",
  };
}

export const isCompleteAccountNumber = (
  value: string,
  rule: AccountNumberRule,
) => new RegExp(`^\\d{${rule.min},${rule.max}}$`).test(value);
