import { describe, expect, it } from "vitest"
import {
  extractTransactionBankDetails,
  getNestedProviderNumber,
  resolveBankNameByCode,
} from "./transaction-detail-metadata"

describe("transaction detail provider metadata", () => {
  it("extracts Centiiv beneficiary bank details", () => {
    const metadata = {
      centiivResponse: {
        rate: "1371.86",
        beneficiary: {
          name: "PROGRESS UZOMA OJEMEH",
          bankAccount: {
            bank_code: "999992",
            account_number: "8064315783",
          },
        },
      },
    }

    expect(extractTransactionBankDetails(metadata)).toEqual({
      bankName: null,
      bankCode: "999992",
      accountName: "PROGRESS UZOMA OJEMEH",
      accountNumber: "8064315783",
    })
    expect(
      getNestedProviderNumber(metadata, "centiivResponse", ["rate"]),
    ).toBe(1371.86)
  })

  it("preserves Paycrest bankDetail extraction", () => {
    expect(
      extractTransactionBankDetails({
        bankDetail: {
          bankName: "Test Bank",
          accountName: "Test User",
          accountNumber: "1234567890",
        },
      }),
    ).toEqual({
      bankName: "Test Bank",
      bankCode: null,
      accountName: "Test User",
      accountNumber: "1234567890",
    })
  })

  it("resolves a Centiiv bank code from the provider directory", () => {
    expect(
      resolveBankNameByCode("999992", [
        { code: "999991", name: "First Bank" },
        { code: "999992", name: "OPay" },
      ]),
    ).toBe("OPay")
  })
})
