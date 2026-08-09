import { ApiResponse, apiFetch, handleResponse } from "./index";

/**
 * --- Onramp Request Interface ---
 * Strictly mapped to your backend controller's destructuring:
 * const { fiatAmount, fiatCurrency, cryptoCurrencyCode, chain, network, ...metadata } = req.body;
 */
export interface OnrampInitRequest {
  fiatAmount: number;
  fiatCurrency: string;
  cryptoCurrencyCode: string;
  cryptocurrency?: string;
  asset?: string;
  token?: string;
  chain: string;
  network: string;
  rate?: number | string | null;
  // Metadata fields - explicitly defined to avoid 'any'
  paymentMethod?: string;
  providerId?: string;
  source?: "web" | "mobile";
  bankId?: string;
  bankAccountId?: string;
  refundBankId?: string;
  refundAccount?: {
    bankName: string;
    bankCode?: string | null;
    accountNumber: string;
    accountName: string;
  };
}

/**
 * --- Onramp Response Interface ---
 * Matches the 'order' object returned by your backend
 */
export interface OnrampResponse {
  id?: string;
  transactionId?: string;
  checkoutUrl?: string;
  url?: string;
  paymentUrl?: string;
  redirectUrl?: string;
  provider: string;
  status: string;
  orderId?: string;
  reference?: string;
  providerReference?: string;
  transactionReference?: string;
  txId?: string;
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
  providerAccount?: {
    institution: string;
    accountIdentifier: string;
    accountName: string;
    validUntil?: string;
    amountToTransfer: string;
    currency: string;
    reference?: string;
  };
  paymentDetails?: {
    accountNumber: string;
    bankName: string;
    accountName: string;
    amount: number;
    reference: string;
    currency?: string;
    validUntil?: string;
  };
  paymentInstructions?: Record<string, unknown>;
  depositInstructions?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  raw?: Record<string, unknown>;
}

type ProviderAccount = NonNullable<OnrampResponse["providerAccount"]>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function getRecord(
  source: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> | null {
  return asRecord(source?.[key]);
}

function getFirstValue(
  source: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

/** Extracts bank instructions from the response shapes used by ramp providers. */
export function extractOnrampTransferInstructions(
  value: unknown,
  fallbackCurrency: string,
  fallbackAmount?: number | string,
): ProviderAccount | null {
  const root = asRecord(value);
  if (!root) return null;

  const metadata = getRecord(root, "metadata");
  const centiivResponse = getRecord(metadata, "centiivResponse");
  const raw = getRecord(root, "raw");
  const candidates = [
    getRecord(root, "providerAccount"),
    getRecord(root, "paymentDetails"),
    getRecord(root, "paymentInstructions"),
    getRecord(root, "depositInstructions"),
    getRecord(root, "virtualAccount"),
    getRecord(root, "bankAccount"),
    getRecord(root, "account"),
    getRecord(root, "temporaryWallet"),
    getRecord(raw, "temporaryWallet"),
    getRecord(raw, "virtualAccount"),
    getRecord(centiivResponse, "temporaryWallet"),
    getRecord(metadata, "paymentInstructions"),
  ].filter((candidate): candidate is Record<string, unknown> => !!candidate);

  for (const candidate of candidates) {
    const accountIdentifier = getFirstValue(candidate, [
      "accountIdentifier",
      "accountNumber",
      "account_number",
      "virtualAccountNumber",
    ]);
    const institution = getFirstValue(candidate, [
      "institution",
      "bankName",
      "bank_name",
      "virtualBankName",
    ]);

    if (!accountIdentifier || !institution) continue;

    return {
      institution,
      accountIdentifier,
      accountName:
        getFirstValue(candidate, [
          "accountName",
          "account_name",
          "virtualAccountName",
          "beneficiaryName",
        ]) || "Kellon App",
      amountToTransfer:
        getFirstValue(candidate, [
          "amountToTransfer",
          "amount",
          "fiatAmount",
        ]) || String(fallbackAmount || ""),
      currency:
        getFirstValue(candidate, ["currency", "fiatCurrency"]) ||
        fallbackCurrency,
      validUntil: getFirstValue(candidate, [
        "validUntil",
        "expiresAt",
        "expires_at",
      ]),
      reference: getFirstValue(candidate, ["reference", "narration"]),
    };
  }

  return null;
}

export function getCentiivPollingReferences(order: OnrampResponse): {
  orderId?: string;
  transactionId?: string;
} {
  const root = asRecord(order);
  const metadata = getRecord(root, "metadata");
  const centiivResponse = getRecord(metadata, "centiivResponse");
  const transaction = getRecord(root, "transaction");

  return {
    orderId:
      getFirstValue(centiivResponse || {}, ["id", "orderId"]) ||
      getFirstValue(root || {}, ["orderId"]),
    transactionId:
      getFirstValue(metadata || {}, ["backendTransactionId"]) ||
      getFirstValue(transaction || {}, ["id", "transactionId"]) ||
      getFirstValue(root || {}, ["transactionId", "id"]),
  };
}

/**
 * Providers return bank-transfer instructions in different shapes. Normalize
 * Centiiv's paymentDetails so the buy flow can render one instruction UI.
 */
export function normalizeOnrampTransferInstructions(
  order: OnrampResponse,
  fallbackCurrency: string,
  fallbackAmount?: number | string,
): OnrampResponse {
  if (order.providerAccount) return order;

  const providerAccount = extractOnrampTransferInstructions(
    order,
    fallbackCurrency,
    fallbackAmount,
  );
  if (!providerAccount) return order;

  return {
    ...order,
    providerAccount,
  };
}

/**
 * --- Onramp Service ---
 */
export const onrampService = {
  initiateRamp: (
    body: OnrampInitRequest,
  ): Promise<ApiResponse<OnrampResponse>> =>
    post("/api/onramp/ramp/initiate", body),

  initiateTransak: (
    body: OnrampInitRequest,
  ): Promise<ApiResponse<OnrampResponse>> =>
    post("/api/onramp/transak/initiate", body),

  initiatePaycrest: (
    body: OnrampInitRequest,
  ): Promise<ApiResponse<OnrampResponse>> =>
    post("/api/onramp/paycrest/initiate", body),

  initiateCentiiv: (
    body: OnrampInitRequest,
  ): Promise<ApiResponse<OnrampResponse>> =>
    post("/api/onramp/centiiv/initiate", body),

  getCentiivOrderStatus: async (
    orderId: string,
  ): Promise<ApiResponse<Record<string, unknown>>> => {
    const res = await apiFetch(
      `/api/onramp/centiiv/order/${encodeURIComponent(orderId)}`,
      { cache: "no-store" },
    );
    return handleResponse(res);
  },

  initiateMoonpay: (
    body: OnrampInitRequest,
  ): Promise<ApiResponse<OnrampResponse>> =>
    post("/api/onramp/moonpay/initiate", body),

  initiateQuidax: (
    body: OnrampInitRequest,
  ): Promise<ApiResponse<OnrampResponse>> =>
    post("/api/onramp/quidax/initiate", body),

  initiatePaychant: (
    body: OnrampInitRequest,
  ): Promise<ApiResponse<OnrampResponse>> =>
    post("/api/onramp/paychant/initiate", body),

  initiatePaybis: (
    body: OnrampInitRequest,
  ): Promise<ApiResponse<OnrampResponse>> =>
    post("/api/onramp/paybis/initiate", body),
};

/**
 * --- Internal POST Helper ---
 * Strictly typed to prevent 'any' pollution
 */
async function post(
  endpoint: string,
  body: OnrampInitRequest,
): Promise<ApiResponse<OnrampResponse>> {
  const res = await apiFetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return handleResponse(res);
}
