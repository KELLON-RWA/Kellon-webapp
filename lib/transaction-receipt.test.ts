import { describe, expect, it } from "vitest";
import {
  AssetType,
  TransactionStatus,
  TransactionType,
  type Transaction,
} from "@/types/db";
import { getTransactionSymbol } from "./dashboard-utils";
import {
  buildTransactionDetailSections,
  escapeReceiptHtml,
  getReceiptPdfImageSize,
  getTransactionNetwork,
  getTransactionReceiptAmount,
  getTransactionReceiptAmountLabel,
} from "./transaction-receipt";

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "receipt-reference",
    userId: "user-1",
    type: TransactionType.WITHDRAW,
    amount: 130.292234,
    symbol: "USDT",
    assetType: AssetType.CRYPTO,
    status: TransactionStatus.PENDING,
    createdAt: new Date("2026-10-15T10:11:00Z"),
    metadata: {},
    ...overrides,
  };
}

function sections(transaction: Transaction) {
  return buildTransactionDetailSections(
    transaction,
    getTransactionReceiptAmount(transaction),
    getTransactionSymbol(transaction),
    getTransactionNetwork(transaction),
  );
}

function rows(transaction: Transaction) {
  return sections(transaction).flatMap((section) => section.rows);
}

describe("transaction receipts", () => {
  it.each(Object.values(TransactionType))(
    "does not prefix %s receipt amounts with a sign",
    (type) => {
      const label = getTransactionReceiptAmountLabel(makeTransaction({ type }));
      expect(label).not.toMatch(/^[+-]/);
    },
  );

  it("keeps crypto amounts separate from a pending withdrawal's expected local payout", () => {
    const transaction = makeTransaction({
      metadata: {
        fiatCurrency: "NGN",
        receiveAmount: 175879.75,
        chain: "solana",
        bankName: "Kuda Microfinance Bank",
        accountName: "KELLON SOFTWARE COMPANY LTD",
        accountNumber: "3004165025",
      },
    });
    expect(getTransactionReceiptAmountLabel(transaction)).toBe(
      "130.292234 USDT",
    );
    expect(rows(transaction)).toEqual(
      expect.arrayContaining([
        { label: "Expected bank payout", value: "₦175,879.75" },
        { label: "Network", value: "Solana Network" },
        { label: "Account Name", value: "KELLON SOFTWARE COMPANY LTD" },
      ]),
    );
  });

  it("uses the settled withdrawal payout instead of the original quote", () => {
    const transaction = makeTransaction({
      status: TransactionStatus.COMPLETED,
      metadata: { settledFiat: 175000, quotedNetFiat: 175879.75 },
    });
    expect(rows(transaction)).toEqual(
      expect.arrayContaining([
        { label: "Bank payout confirmed", value: "₦175,000.00" },
        { label: "Originally quoted", value: "₦175,879.75" },
      ]),
    );
  });

  it("shows delivered crypto and local payment separately for onramps", () => {
    const transaction = makeTransaction({
      type: TransactionType.BUY,
      amount: 5000,
      symbol: "USDC",
      metadata: { fiatCurrency: "NGN", fiatAmount: 5000, cryptoAmount: 3.66 },
    });
    expect(getTransactionReceiptAmountLabel(transaction)).toBe("3.66 USDC");
    expect(rows(transaction)).toContainEqual({
      label: "Amount Paid",
      value: "₦5,000.00",
    });
  });

  it("never labels the local payment as crypto when the delivered amount is missing", () => {
    const transaction = makeTransaction({
      type: TransactionType.BUY,
      amount: 5000,
      symbol: "USDC",
      metadata: { fiatAmount: 5000, fiatCurrency: "NGN" },
    });
    expect(getTransactionReceiptAmountLabel(transaction)).toBe("₦5,000.00");
    expect(rows(transaction)).toContainEqual({
      label: "Amount paid",
      value: "₦5,000.00",
    });
  });

  it.each([TransactionType.BUY, TransactionType.SELL])(
    "labels stock %s shares and USD order values correctly",
    (type) => {
      const transaction = makeTransaction({
        type,
        assetType: AssetType.RWA,
        amount: 25,
        symbol: "AAPL",
        metadata: { shares: 0.1, cost: 25, proceeds: 25, fundingChain: "base" },
      });
      expect(getTransactionReceiptAmountLabel(transaction)).toBe("0.10 AAPL");
      expect(rows(transaction)).toContainEqual({
        label: type === TransactionType.SELL ? "Shares sold" : "Shares bought",
        value: "0.10 AAPL",
      });
      expect(rows(transaction)).toContainEqual({
        label: type === TransactionType.SELL ? "Sale proceeds" : "Amount paid",
        value: "$25.00",
      });
      expect(rows(transaction).some((row) => row.value.includes("₦"))).toBe(
        false,
      );
    },
  );

  it("does not substitute stock order totals for missing shares", () => {
    const transaction = makeTransaction({
      type: TransactionType.BUY,
      assetType: AssetType.RWA,
      amount: 25,
      symbol: "AAPL",
      metadata: { cost: 25 },
    });
    expect(getTransactionReceiptAmountLabel(transaction)).toBe("$25.00");
    expect(rows(transaction)).toContainEqual({
      label: "Shares bought",
      value: "Unavailable AAPL",
    });
  });

  it.each([TransactionType.DEPOSIT, TransactionType.WITHDRAW])(
    "keeps yield %s receipts free of bank payout fields",
    (type) => {
      const transaction = makeTransaction({
        type,
        metadata: {
          protocol: "Morpho",
          provider: "morpho",
          chain: "base",
          receiveAmount: 100,
          bankName: "Stale bank data",
        },
      });
      expect(sections(transaction)).toContainEqual({
        title: "Yield position",
        rows: [{ label: "Protocol", value: "Morpho" }],
      });
      expect(
        rows(transaction).some((row) => /bank|paid/i.test(row.label)),
      ).toBe(false);
    },
  );

  it("includes recipient or sender details for the corresponding transfer direction", () => {
    expect(
      sections(
        makeTransaction({
          type: TransactionType.TRANSFER_OUT,
          metadata: { recipientMethod: "tag", recipientTag: "@recipient" },
        }),
      ),
    ).toContainEqual({
      title: "Recipient",
      rows: [{ label: "Tag", value: "@recipient" }],
    });
    expect(
      sections(
        makeTransaction({
          type: TransactionType.TRANSFER_IN,
          metadata: { senderTag: "@sender" },
        }),
      ),
    ).toContainEqual({
      title: "Sender",
      rows: [{ label: "Tag", value: "@sender", mono: false }],
    });
  });

  it("includes both networks on bridge receipts", () => {
    const transaction = makeTransaction({
      type: TransactionType.BRIDGE,
      metadata: { fromChain: "stellar", toChain: "base" },
    });
    expect(rows(transaction)).toEqual(
      expect.arrayContaining([
        { label: "From network", value: "Stellar Network" },
        { label: "To network", value: "Base Network" },
      ]),
    );
  });

  it("shows the recorded swap amount without claiming an unknown received amount", () => {
    const transaction = makeTransaction({
      type: TransactionType.SWAP,
      amount: 12,
      symbol: "USDC",
    });
    expect(getTransactionReceiptAmountLabel(transaction)).toBe("12 USDC");
    expect(rows(transaction)).toContainEqual({
      label: "Amount swapped",
      value: "12 USDC",
    });
    expect(
      rows(transaction).some((row) => /paid|payout/i.test(row.label)),
    ).toBe(false);
  });

  it("removes stored negative signs without losing the amount's magnitude", () => {
    const transaction = makeTransaction({ amount: -130.292234 });
    expect(getTransactionReceiptAmountLabel(transaction)).toBe(
      "130.292234 USDT",
    );
    expect(rows(transaction)).toContainEqual({
      label: "Amount",
      value: "130.292234 USDT",
    });
  });

  it("retains transaction hashes and full references", () => {
    const hash = `0x${"a".repeat(64)}`;
    const transaction = makeTransaction({ metadata: { txHash: hash } });
    expect(rows(transaction)).toContainEqual({
      label: "Transaction hash",
      value: hash,
      mono: true,
      copyable: true,
    });
    expect(rows(transaction)).toContainEqual({
      label: "Reference ID",
      value: transaction.id,
      mono: true,
      copyable: true,
    });
  });

  it("escapes dynamic receipt values instead of interpreting them as HTML", () => {
    expect(
      escapeReceiptHtml('Company & Partners <script>"test"</script>'),
    ).toBe(
      "Company &amp; Partners &lt;script&gt;&quot;test&quot;&lt;/script&gt;",
    );
  });

  it.each([
    [900, 1400],
    [900, 3000],
  ])("fits a %s by %s receipt within A4 without cropping", (width, height) => {
    const image = getReceiptPdfImageSize(width, height);
    expect(image.width).toBeLessThanOrEqual(190);
    expect(image.height).toBeLessThanOrEqual(277);
    expect(image.width / image.height).toBeCloseTo(width / height);
  });
});
