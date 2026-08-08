import { ApiResponse, apiFetch, handleResponse } from "./index";
import { resolveVerificationType } from "./transfers";

/**
 * --- Offramp Request Interface ---
 * Mapped to the backend OfframpInput:
 * { cryptoAmount, fiatCurrency, cryptoCurrency, chain, bankId, bankDetail, rate, ...metadata }
 */
export interface OfframpInitRequest {
  fiatCurrency: string;
  fiatAmount?: number;
  cryptoAmount: number;
  amount?: number;
  cryptoCurrency: string;
  cryptoCurrencyCode?: string; // Compatibility with the current controller aliases
  cryptocurrency?: string;
  asset?: string;
  token?: string;
  chain: string; // Map from networkId
  network?: string; // Optional alias for chain
  rate?: string | number;
  reference?: string;
  narration?: string;
  description?: string;
  receiveAmount?: number;
  receiveCurrency?: string;
  estimatedFiatAmount?: number;
  country?: string | null;

  // Banking & Recipient Info
  bankId?: string; // database UUID for a saved bank
  bankAccountId?: string; // Alias accepted by the latest controller
  bankDetail?: {
    id?: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    bankCode?: string;
    swift?: string;
    routingNumber?: string;
    iban?: string;
  };
  recipient?: string | object; // Email, phone, or complex object

  // Security / MFA Fields
  verificationCode?: string; // OTP or TOTP code
  verificationType?: "otp" | "totp";
  verificationCodes?: Record<string, string>;

  paymentMethod?: string;
}

/**
 * --- Offramp Response Interface ---
 */
export interface OfframpResponse {
  id?: string;
  success?: boolean;
  transactionId?: string;
  transactionReference?: string;
  txId?: string;
  orderId?: string;
  reference?: string;
  providerReference?: string;
  checkoutUrl?: string; // e.g. for Moonpay/Transak
  paymentUrl?: string;
  redirectUrl?: string;
  url?: string; // e.g. for MoneyGram
  provider?: string;
  status?: string;
  message?: string;
  // Deposit-address settlement — the client moves the tokens. See hooks/useOfframpFunding.
  depositAddress?: string;
  depositInstructions?: {
    address?: string;
    memo?: string;
    expiresAt?: string;
  } | null;
  requiredTokenAmount?: number | string;
  tokenAddress?: string;
  fundingTxHash?: string;
  transaction?: {
    id?: string;
    transactionId?: string;
  };
  order?: {
    id?: string;
    transactionId?: string;
    reference?: string;
  };
  // If MFA is needed, backend returns 403 with these:
  code?: "VERIFICATION_REQUIRED";
  verificationType?: "otp" | "totp";
}

type OfframpErrorBody = {
  message?: string;
  code?: string;
  verificationType?: "otp" | "totp";
  availableMethods?: string[];
  error?:
    | string
    | {
        message?: string;
        code?: string;
        verificationType?: "otp" | "totp";
        availableMethods?: string[];
      };
};

export class OfframpVerificationRequiredError extends Error {
  verificationType: "otp" | "totp";
  availableMethods?: string[];

  constructor(
    message: string,
    verificationType: "otp" | "totp" = "otp",
    availableMethods?: string[],
  ) {
    super(message);
    this.name = "OfframpVerificationRequiredError";
    this.verificationType = verificationType;
    this.availableMethods = availableMethods;
  }
}

/**
 * --- Offramp Service ---
 */
export const offrampService = {
  initiatePaychant: (body: OfframpInitRequest) =>
    post("/api/offramp/paychant", body),

  initiateTransak: (body: OfframpInitRequest) =>
    post("/api/offramp/transak", body),

  initiateRamp: (body: OfframpInitRequest) => post("/api/offramp/ramp", body),

  initiatePaycrest: (body: OfframpInitRequest) =>
    post("/api/offramp/paycrest", body),

  initiateCentiiv: (body: OfframpInitRequest) =>
    post("/api/offramp/centiiv", body),

  initiateMoonpay: (body: OfframpInitRequest) =>
    post("/api/offramp/moonpay", body),

  initiateQuidax: (body: OfframpInitRequest) =>
    post("/api/offramp/quidax", body),

  /**
   * Specialized MoneyGram Offramp (Uses Stellar Network)
   */
  initiateMoneyGram: (body: OfframpInitRequest) =>
    post("/api/offramp/moneygram", body),

  /**
   * Centiiv Fund Destination
   */
  fundCentiiv: async (body: {
    transactionId: string;
  }): Promise<ApiResponse<{ success: boolean }>> => {
    const res = await apiFetch("/api/offramp/centiiv/fund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },
};

/**
 * --- Internal POST Helper ---
 */
async function post(
  endpoints: string | string[],
  body: OfframpInitRequest,
): Promise<ApiResponse<OfframpResponse>> {
  const candidates = Array.isArray(endpoints) ? endpoints : [endpoints];
  let lastResponse: Response | null = null;
  const requestBody = sanitizeOfframpPayload(body);

  for (const endpoint of candidates) {
    const res = await apiFetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-platform": typeof window !== "undefined" ? "web" : "mobile",
      },
      body: JSON.stringify(requestBody),
    });

    if (res.status !== 404 || endpoint === candidates[candidates.length - 1]) {
      return handleOfframpResponse(res);
    }

    lastResponse = res;
  }

  return handleOfframpResponse(lastResponse as Response);
}

async function handleOfframpResponse(
  response: Response,
): Promise<ApiResponse<OfframpResponse>> {
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const body = (json || {}) as OfframpErrorBody;
    const nestedError =
      typeof body.error === "object" && body.error ? body.error : null;
    const code = nestedError?.code || body.code;
    const message =
      body.message ||
      nestedError?.message ||
      (typeof body.error === "string" ? body.error : undefined) ||
      "Unable to initialize withdrawal";
    const availableMethods =
      body.availableMethods || nestedError?.availableMethods;
    const requestedVerificationType =
      nestedError?.verificationType || body.verificationType;
    const verificationType = requestedVerificationType
      ? requestedVerificationType
      : resolveVerificationType(availableMethods);
    const verificationSignals = [
      code,
      body.message,
      typeof body.error === "string" ? body.error : nestedError?.message,
    ];
    const requiresVerification =
      response.status === 403 &&
      (verificationSignals.some(
        (value) =>
          typeof value === "string" &&
          value.toUpperCase().replaceAll(" ", "_") === "VERIFICATION_REQUIRED",
      ) ||
        Boolean(availableMethods?.length));

    if (requiresVerification) {
      throw new OfframpVerificationRequiredError(
        message === "VERIFICATION_REQUIRED" ? "Verification required" : message,
        verificationType,
        availableMethods,
      );
    }

    throw new Error(message);
  }

  return {
    success: true,
    data: json?.data !== undefined ? json.data : json,
    message: json?.message,
  };
}

function sanitizeOfframpPayload(
  body: OfframpInitRequest,
): Record<string, unknown> {
  const payload = Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined),
  );

  if (body.bankDetail) {
    payload.bankDetail = Object.fromEntries(
      Object.entries(body.bankDetail).filter(
        ([, value]) => value !== undefined,
      ),
    );
  }

  return payload;
}
