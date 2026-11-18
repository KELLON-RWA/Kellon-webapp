import { describe, expect, it } from "vitest";
import {
  extractOnrampTransferInstructions,
  getCentiivPollingReferences,
  normalizeOnrampTransferInstructions,
  type OnrampResponse,
} from "./on-ramp";

describe("on-ramp transfer instructions", () => {
  it("normalizes Centiiv payment details for the shared instruction UI", () => {
    const response: OnrampResponse = {
      provider: "centiiv",
      status: "PENDING",
      paymentDetails: {
        bankName: "Test Bank",
        accountNumber: "1234567890",
        accountName: "Centiiv Payments",
        amount: 2000,
        reference: "CENTIIV-123",
      },
    };

    expect(normalizeOnrampTransferInstructions(response, "NGN")).toEqual({
      ...response,
      providerAccount: {
        institution: "Test Bank",
        accountIdentifier: "1234567890",
        accountName: "Centiiv Payments",
        amountToTransfer: "2000",
        currency: "NGN",
        validUntil: undefined,
        reference: "CENTIIV-123",
      },
    });
  });

  it("preserves provider accounts that are already normalized", () => {
    const response: OnrampResponse = {
      provider: "paycrest",
      status: "PENDING",
      providerAccount: {
        institution: "Test Bank",
        accountIdentifier: "1234567890",
        accountName: "Paycrest Payments",
        amountToTransfer: "2000",
        currency: "NGN",
      },
    };

    expect(normalizeOnrampTransferInstructions(response, "USD")).toBe(response);
  });

  it("extracts Centiiv virtual accounts returned asynchronously", () => {
    expect(
      extractOnrampTransferInstructions(
        {
          temporaryWallet: {
            virtualBankName: "Centiiv Bank",
            virtualAccountNumber: "0987654321",
            virtualAccountName: "Kellon Collection",
            narration: "ORDER-123",
            expiresAt: "2026-08-08T14:00:00.000Z",
          },
        },
        "NGN",
        2000,
      ),
    ).toEqual({
      institution: "Centiiv Bank",
      accountIdentifier: "0987654321",
      accountName: "Kellon Collection",
      amountToTransfer: "2000",
      currency: "NGN",
      reference: "ORDER-123",
      validUntil: "2026-08-08T14:00:00.000Z",
    });
  });

  it("normalizes Ramphub bank transfer instructions into providerAccount", () => {
    const response: OnrampResponse = {
      provider: "ramphub",
      status: "PENDING",
      paymentInstructions: {
        bankName: "Providus Bank",
        accountNumber: "9988776655",
        accountName: "Kellon Ramphub Settlement",
        amountToTransfer: "50000",
        currency: "NGN",
        reference: "RAMP-9988",
        expiresAt: "2026-12-01T12:00:00.000Z",
      },
    };

    expect(normalizeOnrampTransferInstructions(response, "NGN")).toEqual({
      ...response,
      providerAccount: {
        institution: "Providus Bank",
        accountIdentifier: "9988776655",
        accountName: "Kellon Ramphub Settlement",
        amountToTransfer: "50000",
        currency: "NGN",
        reference: "RAMP-9988",
        validUntil: "2026-12-01T12:00:00.000Z",
      },
    });
  });

  it("finds the Centiiv order and backend transaction polling references", () => {
    expect(
      getCentiivPollingReferences({
        provider: "centiiv",
        status: "PENDING",
        transactionId: "transaction-123",
        metadata: {
          backendTransactionId: "backend-transaction-123",
          centiivResponse: { id: "centiiv-order-123" },
        },
      }),
    ).toEqual({
      orderId: "centiiv-order-123",
      transactionId: "backend-transaction-123",
    });
  });
});
