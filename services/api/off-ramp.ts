import { ApiResponse, apiFetch, handleResponse } from "./index";

/**
 * --- Offramp Request Interface ---
 * Mapped to the backend OfframpInput:
 * { cryptoAmount, fiatCurrency, cryptoCurrency, chain, bankId, bankDetail, rate, ...metadata }
 */
export interface OfframpInitRequest {
  fiatCurrency: string;
  cryptoAmount: number;
  cryptoCurrency: string;
  cryptoCurrencyCode?: string; // Compatibility with the current controller aliases
  cryptocurrency?: string;
  asset?: string;
  token?: string;
  chain: string; // Map from networkId
  network?: string; // Optional alias for chain
  rate?: string;
  reference?: string;
  narration?: string;
  description?: string;
  receiveAmount?: number;
  receiveCurrency?: string;
  estimatedFiatAmount?: number;
  country?: string | null;

  // Banking & Recipient Info
  bankId?: string; // database UUID for a saved bank
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

/**
 * --- Offramp Service ---
 */
export const offrampService = {
  initiatePaychant: (body: OfframpInitRequest) =>
    post("/api/offramp/paychant", body),

  initiateTransak: (body: OfframpInitRequest) =>
    post("/api/offramp/transak", body),

  initiateRamp: (body: OfframpInitRequest) =>
    post("/api/offramp/ramp", body),

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
      return handleResponse(res);
    }

    lastResponse = res;
  }

  return handleResponse(lastResponse as Response);
}

function sanitizeOfframpPayload(
  body: OfframpInitRequest,
): Record<string, unknown> {
  const payload = Object.fromEntries(
    Object.entries(body).filter(
      ([key, value]) => key !== "fiatAmount" && value !== undefined,
    ),
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
