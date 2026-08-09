export interface TransactionBankDetails {
  bankName: string | null
  bankCode: string | null
  accountName: string | null
  accountNumber: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null
}

function nestedRecord(
  source: Record<string, unknown> | null,
  ...path: string[]
): Record<string, unknown> | null {
  return path.reduce<Record<string, unknown> | null>(
    (current, key) => asRecord(current?.[key]),
    source,
  )
}

function firstString(
  sources: Array<Record<string, unknown> | null>,
  keys: string[],
): string | null {
  for (const source of sources) {
    if (!source) continue

    for (const key of keys) {
      const value = source[key]
      if (typeof value === "string" && value.trim()) return value.trim()
      if (typeof value === "number" && Number.isFinite(value)) {
        return String(value)
      }
    }
  }

  return null
}

/** Normalizes Paycrest and Centiiv beneficiary metadata for receipt display. */
export function extractTransactionBankDetails(
  metadataValue: unknown,
): TransactionBankDetails {
  const metadata = asRecord(metadataValue)
  if (!metadata) {
    return {
      bankName: null,
      bankCode: null,
      accountName: null,
      accountNumber: null,
    }
  }

  const centiivResponse = nestedRecord(metadata, "centiivResponse")
  const amountDetails = nestedRecord(metadata, "amountDetails")
  const details = nestedRecord(metadata, "details")
  const nestedMetadata = nestedRecord(metadata, "metadata")
  const beneficiary =
    nestedRecord(metadata, "beneficiary") ||
    nestedRecord(amountDetails, "beneficiary") ||
    nestedRecord(centiivResponse, "beneficiary")
  const beneficiaryDetails = nestedRecord(beneficiary, "details")
  const bankAccount =
    nestedRecord(metadata, "bankAccount") ||
    nestedRecord(metadata, "bankDetail") ||
    nestedRecord(details, "bankDetail") ||
    nestedRecord(nestedMetadata, "bankDetail") ||
    nestedRecord(nestedMetadata, "details", "bankDetail") ||
    nestedRecord(beneficiary, "bankAccount") ||
    nestedRecord(beneficiaryDetails, "bankAccount") ||
    nestedRecord(amountDetails, "receivable_account_details")
  const resolvedBank = nestedRecord(metadata, "resolvedBank")
  const bank =
    nestedRecord(bankAccount, "bank") ||
    nestedRecord(beneficiary, "bank") ||
    nestedRecord(centiivResponse, "bank") ||
    nestedRecord(metadata, "bank")

  const sources = [
    bankAccount,
    nestedRecord(details, "bankDetail"),
    resolvedBank,
    beneficiaryDetails,
    beneficiary,
    centiivResponse,
    metadata,
    amountDetails,
  ]

  return {
    bankName:
      firstString([bank], ["name", "bankName", "bank_name"]) ||
      firstString(sources, [
        "bankName",
        "bank_name",
        "bank",
        "beneficiary_bank",
        "beneficiaryBank",
        "institution",
      ]),
    bankCode:
      firstString([bank], ["code", "bankCode", "bank_code"]) ||
      firstString(sources, [
        "bankCode",
        "bank_code",
        "institutionCode",
        "institution_code",
      ]),
    accountName: firstString(sources, [
      "accountName",
      "account_name",
      "name",
      "beneficiary_name",
      "beneficiaryName",
    ]),
    accountNumber: firstString(sources, [
      "accountNumber",
      "account_number",
      "accountIdentifier",
      "bank_account",
      "receivable_account",
      "beneficiary_account",
      "beneficiaryAccountNumber",
    ]),
  }
}

export function resolveBankNameByCode(
  bankCode: string | null,
  banks: Array<{ code: string | number; name: string }>,
): string | null {
  if (!bankCode) return null

  const normalizedCode = bankCode.trim().toLowerCase()
  return (
    banks.find(
      (bank) => String(bank.code).trim().toLowerCase() === normalizedCode,
    )?.name || null
  )
}

export function getNestedProviderNumber(
  metadataValue: unknown,
  parentKey: string,
  keys: string[],
): number | null {
  const parent = nestedRecord(asRecord(metadataValue), parentKey)
  if (!parent) return null

  for (const key of keys) {
    const value = parent[key]
    const parsed =
      typeof value === "string" || typeof value === "number"
        ? Number(value)
        : NaN
    if (Number.isFinite(parsed)) return parsed
  }

  return null
}
