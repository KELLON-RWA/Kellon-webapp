import { describe, expect, it } from "vitest";
import { giftFormSchema } from "@/components/gifts/gift-types";
import { invoiceSchema } from "@/components/invoices/create-invoice/types";
import { amountSchema } from "@/components/wallet/send/send-utils";
import { guardianSchema, quickRecoverySchema } from "./social-recovery";

describe("user input validation", () => {
  it("accepts well-formed invoice and gift amounts", () => {
    expect(
      invoiceSchema.safeParse({
        amount: "12.5",
        assetSymbol: "USDC",
        chain: "base",
        customerContact: "customer@example.com",
        expiryPreset: "1d",
      }).success,
    ).toBe(true);

    expect(
      giftFormSchema.safeParse({
        templateId: "custom",
        assetKey: "USDC:base",
        amount: "12.5",
        recipient: "@customer",
        cardTitle: "",
        message: "",
      }).success,
    ).toBe(true);
  });

  it.each(["Infinity", "NaN", "1e3", "1.1234567", "0"])(
    "rejects unsafe or unsupported amounts: %s",
    (amount) => {
      expect(
        invoiceSchema.safeParse({
          amount,
          assetSymbol: "USDC",
          chain: "base",
          customerContact: "customer@example.com",
          expiryPreset: "1d",
        }).success,
      ).toBe(false);
      expect(
        giftFormSchema.safeParse({
          templateId: "custom",
          assetKey: "USDC:base",
          amount,
          recipient: "@customer",
          cardTitle: "",
          message: "",
        }).success,
      ).toBe(false);
    },
  );

  it("enforces supported recipient, guardian, and recovery address formats", () => {
    expect(amountSchema.safeParse({ amount: "1.25" }).success).toBe(true);
    expect(amountSchema.safeParse({ amount: "1e3" }).success).toBe(false);
    expect(
      guardianSchema.safeParse({ guardianId: "@trusted.user" }).success,
    ).toBe(true);
    expect(guardianSchema.safeParse({ guardianId: "not valid" }).success).toBe(
      false,
    );
    expect(
      quickRecoverySchema.safeParse({
        newOwnerAddress: "0x1234567890123456789012345678901234567890",
        chain: "base",
      }).success,
    ).toBe(true);
    expect(
      quickRecoverySchema.safeParse({
        newOwnerAddress: "not-an-address",
        chain: "base",
      }).success,
    ).toBe(false);
  });
});
