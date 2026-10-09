import { describe, expect, it } from "vitest";
import type { Transaction } from "@/types/db";
import {
  getTransactionAmountLabel,
  getTransactionDisplayAmount,
  getTransactionFiatAmount,
  getTransactionHash,
  getTransactionOperation,
  getStockTransactionFiatLabel,
  getTransactionTitle,
  isStockTransaction,
} from "./dashboard-utils";

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "transaction-1",
    userId: "user-1",
    type: "BUY",
    amount: 3_000,
    symbol: "USDC",
    assetType: "CRYPTO",
    status: "COMPLETED",
    createdAt: new Date("2026-09-30T15:09:00Z"),
    metadata: {},
    ...overrides,
  } as Transaction;
}

describe("transaction display amounts", () => {
  it("uses an explicit delivered crypto amount instead of the fiat payment", () => {
    const transaction = makeTransaction({
      metadata: { fiatAmount: 3_000, cryptoAmount: 2.17 },
    });

    expect(getTransactionDisplayAmount(transaction)).toBe(2.17);
    expect(getTransactionAmountLabel(transaction)).toBe("+2.17 USDC");
    expect(getTransactionTitle(transaction)).toBe("Buy USDC");
  });

  it("supports the newer estimated receivable amount", () => {
    const transaction = makeTransaction({
      type: "DEPOSIT" as Transaction["type"],
      metadata: { fiatAmount: 3_000, estimatedReceivableAmount: "2.17" },
    });

    expect(getTransactionDisplayAmount(transaction)).toBe(2.17);
    expect(getTransactionAmountLabel(transaction)).toBe("+2.17 USDC");
    expect(getTransactionTitle(transaction)).toBe("USDC Deposit");
  });

  it("uses Centiiv's direct receivable amount instead of its fiat amount", () => {
    const transaction = makeTransaction({
      type: "DEPOSIT" as Transaction["type"],
      metadata: {
        provider: "centiiv",
        fiatAmount: 3_000,
        receivableAmount: "2.17",
      },
    });

    expect(getTransactionDisplayAmount(transaction)).toBe(2.17);
    expect(getTransactionAmountLabel(transaction)).toBe("+2.17 USDC");
  });

  it("uses Paycrest's provider amount from its provider response", () => {
    const transaction = makeTransaction({
      metadata: {
        providerName: "paycrest",
        fiatAmount: 3_000,
        providerResponse: { providerAmount: "2.17" },
      },
    });

    expect(getTransactionDisplayAmount(transaction)).toBe(2.17);
  });

  it("resolves delivered crypto from an older nested provider payload", () => {
    const transaction = makeTransaction({
      type: "DEPOSIT" as Transaction["type"],
      metadata: {
        details: {
          amountDetails: {
            fiatAmount: 3_000,
            cryptoAmount: "2.17",
          },
        },
      },
    });

    expect(getTransactionDisplayAmount(transaction)).toBe(2.17);
    expect(getTransactionAmountLabel(transaction)).toBe("+2.17 USDC");
  });

  it("uses a nested stablecoin USD value when the provider omits cryptoAmount", () => {
    const transaction = makeTransaction({
      type: "DEPOSIT" as Transaction["type"],
      metadata: {
        providerResponse: {
          amountPaid: 3_000,
          usdValue: "2.17",
        },
      },
    });

    expect(getTransactionDisplayAmount(transaction)).toBe(2.17);
  });

  it.each([
    ["amountReceived", "2.17"],
    ["amount_received", 2.17],
    ["receiveAmount", "2.17"],
    ["quotedAmount", 2.17],
  ])("supports the legacy %s delivered-amount field", (key, value) => {
    const transaction = makeTransaction({
      type: "DEPOSIT" as Transaction["type"],
      metadata: {
        provider: "centiiv",
        fiatAmount: 3_000,
        providerResponse: { [key]: value },
      },
    });

    expect(getTransactionDisplayAmount(transaction)).toBe(2.17);
    expect(getTransactionAmountLabel(transaction)).toBe("+2.17 USDC");
  });

  it("does not fall back to nested fiat as a token amount", () => {
    const transaction = makeTransaction({
      type: "DEPOSIT" as Transaction["type"],
      metadata: {
        paymentDetails: { amountToTransfer: 3_000 },
      },
    });

    expect(getTransactionDisplayAmount(transaction)).toBeNull();
  });

  it("derives a Centiiv-style token-per-fiat quote for older records", () => {
    const transaction = makeTransaction({
      metadata: { fiatAmount: 3_000, rate: 0.0007233333333333333 },
    });

    expect(getTransactionDisplayAmount(transaction)).toBeCloseTo(2.17, 6);
    expect(getTransactionAmountLabel(transaction)).toBe("+2.17 USDC");
  });

  it("derives a Paycrest-style fiat-per-token quote for older records", () => {
    const transaction = makeTransaction({
      metadata: { fiatAmount: 3_000, rate: 1_382.4884792626728 },
    });

    expect(getTransactionDisplayAmount(transaction)).toBeCloseTo(2.17, 6);
  });

  it("does not mislabel a known fiat payment as crypto without a quote", () => {
    const transaction = makeTransaction({
      metadata: { fiatAmount: 3_000 },
    });

    expect(getTransactionDisplayAmount(transaction)).toBeNull();
    expect(getTransactionAmountLabel(transaction)).toBe("-- USDC");
  });

  it("treats a legacy provider amount as the local-currency payment", () => {
    const transaction = makeTransaction({
      type: "DEPOSIT" as Transaction["type"],
      amount: "5000",
      metadata: { provider: "legacy-provider" },
    });

    expect(getTransactionDisplayAmount(transaction)).toBeNull();
    expect(getTransactionFiatAmount(transaction)).toBe(5_000);
    expect(getTransactionAmountLabel(transaction)).toBe("-- USDC");
  });

  it("uses the on-chain webhook value when the persisted amount is unavailable", () => {
    const transaction = makeTransaction({
      type: "DEPOSIT" as Transaction["type"],
      amount: 0,
      metadata: {
        source: "alchemy_webhook",
        fiatAmount: 3_000,
        raw: { value: "2.17" },
      },
    });

    expect(getTransactionDisplayAmount(transaction)).toBe(2.17);
    expect(getTransactionAmountLabel(transaction)).toBe("+2.17 USDC");
  });
});

describe("transaction hash resolution", () => {
  it("uses the persisted blockchain provider reference", () => {
    const hash = "0x" + "a".repeat(64);
    const transaction = makeTransaction({ providerReference: hash });

    expect(getTransactionHash(transaction)).toBe(hash);
  });

  it("resolves legacy hashes from nested metadata", () => {
    const hash = "b".repeat(64);
    const transaction = makeTransaction({
      metadata: { payload: { transaction_hash: hash } },
    });

    expect(getTransactionHash(transaction)).toBe(hash);
  });

  it("does not present a provider order reference as a blockchain hash", () => {
    const transaction = makeTransaction({
      providerReference: "order_12345",
    });

    expect(getTransactionHash(transaction)).toBeNull();
  });
});

describe("transaction operations", () => {
  it("labels a yield supply recorded as a deposit as a stake", () => {
    const transaction = makeTransaction({
      type: "DEPOSIT" as Transaction["type"],
      amount: 1,
      executionMethod: "yield",
      metadata: {
        provider: "beefy",
        protocol: "Beefy",
        action: "supply",
      },
    });

    expect(getTransactionOperation(transaction)).toBe("stake");
    expect(getTransactionTitle(transaction)).toBe("Stake USDC");
    expect(getTransactionAmountLabel(transaction)).toBe("+1 USDC");
  });

  it("labels a yield withdrawal as an unstake", () => {
    const transaction = makeTransaction({
      type: "WITHDRAW" as Transaction["type"],
      amount: 2.000435,
      metadata: {
        provider: "beefy",
        opportunityId: "opportunity-1",
        operation: "withdraw",
      },
    });

    expect(getTransactionOperation(transaction)).toBe("unstake");
    expect(getTransactionTitle(transaction)).toBe("Unstake USDC");
    expect(getTransactionAmountLabel(transaction)).toBe("-2.000435 USDC");
  });

  it("recognizes supported yield providers even when no action is returned", () => {
    const stake = makeTransaction({
      type: "DEPOSIT" as Transaction["type"],
      metadata: { provider: "Morpho" },
    });
    const unstake = makeTransaction({
      type: "WITHDRAW" as Transaction["type"],
      metadata: { provider: "Aave V3" },
    });

    expect(getTransactionOperation(stake)).toBe("stake");
    expect(getTransactionOperation(unstake)).toBe("unstake");
  });

  it("keeps ordinary deposits and withdrawals unchanged", () => {
    const deposit = makeTransaction({
      type: "DEPOSIT" as Transaction["type"],
      amount: 1,
    });
    const withdrawal = makeTransaction({
      type: "WITHDRAW" as Transaction["type"],
      amount: 1,
      metadata: { fiatCurrency: "NGN" },
    });

    expect(getTransactionOperation(deposit)).toBe("deposit");
    expect(getTransactionTitle(deposit)).toBe("USDC Deposit");
    expect(getTransactionOperation(withdrawal)).toBe("withdraw");
    expect(getTransactionTitle(withdrawal)).toBe("NGN Withdrawal");
  });
});

describe("stock transaction display", () => {
  it("uses the recorded share quantity instead of the USD buy order total", () => {
    const transaction = makeTransaction({
      assetType: "RWA" as Transaction["assetType"],
      amount: 1,
      symbol: "NVDAB",
      metadata: {
        shares: 0.004254,
        amountFiat: 1,
        price: 235.08,
        fundingChain: "bnb",
      },
    });

    expect(isStockTransaction(transaction)).toBe(true);
    expect(getTransactionDisplayAmount(transaction)).toBe(0.004254);
    expect(getTransactionAmountLabel(transaction)).toBe("+0.004254 NVDAB");
    expect(getStockTransactionFiatLabel(transaction)).toBe("$-1.00");
    expect(getTransactionTitle(transaction)).toBe("Buy NVDAB");
  });

  it("uses sale proceeds as the USD value while retaining the sold shares", () => {
    const transaction = makeTransaction({
      type: "SELL" as Transaction["type"],
      assetType: "RWA" as Transaction["assetType"],
      amount: 0.98,
      symbol: "BNVDA",
      metadata: {
        shares: 0.004205,
        proceeds: 0.98,
        price: 235.08,
      },
    });

    expect(getTransactionDisplayAmount(transaction)).toBe(0.004205);
    expect(getTransactionAmountLabel(transaction)).toBe("-0.004205 BNVDA");
    expect(getStockTransactionFiatLabel(transaction)).toBe("$+0.98");
    expect(getTransactionTitle(transaction)).toBe("Sell BNVDA");
  });
});
