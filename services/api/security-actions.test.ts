import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./index";
import { securityService } from "./security";

vi.mock("./index", () => ({ apiFetch: vi.fn(), handleResponse: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(apiFetch).mockImplementation(
    async () =>
      new Response(
        JSON.stringify({ success: true, data: { secret: "test-secret" } }),
      ),
  );
});
describe("authenticator security actions", () => {
  it("retains the existing boolean setup signature", async () => {
    await securityService.setupTotp(true);
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/security/totp/setup",
      expect.objectContaining({ body: JSON.stringify({ reset: true }) }),
      { signed: true },
    );
  });
  it("passes step-up proof when setting up or disabling TOTP", async () => {
    const proof = {
      verificationType: "email_otp" as const,
      verificationCode: "123456",
    };
    await securityService.setupTotp(proof);
    expect(apiFetch).toHaveBeenLastCalledWith(
      "/api/security/totp/setup",
      expect.objectContaining({
        body: JSON.stringify({ reset: false, ...proof }),
      }),
      { signed: true },
    );
    await securityService.disableTotp(proof);
    expect(apiFetch).toHaveBeenLastCalledWith(
      "/api/security/totp/disable",
      expect.objectContaining({ body: JSON.stringify(proof) }),
      { signed: true },
    );
  });
  it("retains the existing authenticator code disable signature", async () => {
    await securityService.disableTotp("123456");
    expect(apiFetch).toHaveBeenLastCalledWith(
      "/api/security/totp/disable",
      expect.objectContaining({ body: JSON.stringify({ code: "123456" }) }),
      { signed: true },
    );
  });
});
