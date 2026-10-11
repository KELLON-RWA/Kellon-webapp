import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./index";
import {
  OfframpApiError,
  OfframpVerificationRequiredError,
  offrampService,
} from "./off-ramp";

vi.mock("./index", () => ({ apiFetch: vi.fn(), handleResponse: vi.fn() }));

const payload = {
  fiatCurrency: "NGN",
  cryptoAmount: 2,
  cryptoCurrency: "USDC",
  chain: "bnb",
  quoteId: "quote-1",
};
const respond = (body: unknown, status = 400) =>
  vi
    .mocked(apiFetch)
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("withdrawal quote recovery", () => {
  beforeEach(() => vi.resetAllMocks());

  it("preserves changed terms and the existing transaction ID", async () => {
    const body = {
      code: "OFFRAMP_TERMS_CHANGED",
      message: "Rate changed",
      transactionId: "order-1",
      quoted: { debit: "2", payout: "3000", currency: "NGN" },
      updated: { debit: "2", payout: "2900", currency: "NGN" },
    };
    respond(body, 409);
    await expect(
      offrampService.initiatePaycrest(payload),
    ).rejects.toMatchObject({
      name: "OfframpApiError",
      code: body.code,
      status: 409,
      body,
    });
  });

  it("keeps a fresh quote from structured nested errors", async () => {
    const requote = {
      quoteId: "quote-2",
      expiresAt: "2026-10-12T00:00:00Z",
      maxCryptoDebit: "2",
      netFiat: "2900",
      rate: "1450",
    };
    respond({
      error: {
        code: "OFFRAMP_REQUOTE_REQUIRED",
        message: "Stale quote",
        requote,
      },
    });
    await expect(
      offrampService.initiatePaycrest(payload),
    ).rejects.toMatchObject({
      code: "OFFRAMP_REQUOTE_REQUIRED",
      body: { requote },
    });
  });

  it("retains the duplicate wait window", async () => {
    respond({ code: "OFFRAMP_DUPLICATE_WAIT", retryAfterSeconds: 45 }, 409);
    await expect(
      offrampService.initiatePaycrest(payload),
    ).rejects.toMatchObject({
      code: "OFFRAMP_DUPLICATE_WAIT",
      body: { retryAfterSeconds: 45 },
    });
  });

  it("keeps verification challenges distinct from provider errors", async () => {
    respond({ code: "VERIFICATION_REQUIRED", availableMethods: ["totp"] }, 403);
    await expect(
      offrampService.initiatePaycrest(payload),
    ).rejects.toBeInstanceOf(OfframpVerificationRequiredError);
  });

  it("accepts the existing order using an encoded ID and a signed POST", async () => {
    respond(
      {
        data: {
          transactionId: "order/1",
          depositAddress: "0xDeposit",
          requiredTokenAmount: "2",
        },
      },
      200,
    );
    await expect(offrampService.acceptTerms("order/1")).resolves.toMatchObject({
      data: { transactionId: "order/1", requiredTokenAmount: "2" },
    });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/offramp/order%2F1/accept-terms",
      expect.objectContaining({ method: "POST", body: "{}" }),
      { signed: true },
    );
  });

  it("does not hide a failed decline", async () => {
    respond({ message: "Cannot cancel", code: "ORDER_BUSY" }, 409);
    await expect(offrampService.declineTerms("order-1")).rejects.toBeInstanceOf(
      OfframpApiError,
    );
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/offramp/order-1/decline-terms",
      expect.objectContaining({ method: "POST" }),
      { signed: true },
    );
  });
});
