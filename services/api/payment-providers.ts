import { ApiResponse, handleResponse } from "./index";
import { getCachedApiResponse } from "./cache";

/**
 * --- Strict Request Interfaces ---
 */
export interface ProviderListQuery {
  country?: string;
  currency?: string;
  network?: string;
  type?: string;
}

export interface PaycrestRateParams {
  token: string;
  amount: number;
  currency: string;
  network: string;
  side?: "buy" | "sell";
}

export interface CentiivQuoteRequest {
  fromAsset: string;
  toAsset: string;
  amount: number;
  /** Chain key. Omitting it makes Centiiv quote STELLAR regardless of the order's chain. */
  network?: string;
}

export interface BankVerificationRequest {
  bankCode: string;
  accountNumber: string;
  save?: boolean;
  bankName?: string;
  accountName?: string;
}

export interface PaycrestAccountVerificationRequest {
  institution: string;
  accountIdentifier: string;
  currency?: string;
  save?: boolean;
  bankName?: string;
  accountName?: string;
}

export interface PaycrestWebhookDeliveriesQuery {
  status?: string;
  event?: string;
  orderId?: string;
  page?: number;
  pageSize?: number;
}

/**
 * --- Strict Response Interfaces ---
 * Defined based on backend controller property access
 */
export interface PaymentProvider {
  id: string;
  name: string;
  slug: string;
  isEnabled: boolean;
  fees?: ProviderFee;
  health?: {
    state: string;
    isHealthy: boolean;
  };
}

export interface ProviderFee {
  percentage?: number;
  fixed?: number;
}

export type ProviderFeesResponse = Record<string, ProviderFee>;

export interface PaycrestRateResponse {
  buy?: {
    rate: string; // e.g. "1381.57"
    price?: number | string;
    providerIds: string[];
    orderType: string;
    refundTimeoutMinutes: number;
  };
  sell?: {
    rate: string;
    price?: number | string;
    providerIds: string[];
    orderType: string;
    refundTimeoutMinutes: number;
  };
  rate?: number | string;
  price?: number | string;
  sendAmount?: string;
  sendCurrency?: string;
  fiatAmount?: number;
  fees?: number;
  feeCurrency?: string;
  receiveAmount?: number;
  receiveCurrency?: string;
  data?: {
    rate?: number | string;
    price?: number | string;
    [key: string]: unknown;
  };
}

export interface CentiivQuoteResponse {
  rate: string;
  estimatedReceivableAmount: string;
  fees: string;
}

export interface BankAccountData {
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  bank_name?: string;
  account_name?: string;
  raw?: unknown;
  [key: string]: unknown;
}

export interface CentiivBank {
  name: string;
  code: string;
}

export interface PaycrestInstitution {
  name?: string;
  code?: string;
  id?: string;
  institution?: string;
  logo?: string;
  logoUrl?: string;
  image?: string;
  imageUrl?: string;
  icon?: string;
  avatar?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PaycrestAccountData {
  accountName?: string;
  account_name?: string;
  accountNumber?: string;
  account_number?: string;
  bankCode?: string;
  bank_code?: string;
  name?: string;
  institutionName?: string;
  bankName?: string;
  raw?: unknown;
  [key: string]: unknown;
}

export interface PaycrestMarket {
  [key: string]: unknown;
}

export interface PaycrestWebhookDelivery {
  id?: string;
  status?: string;
  event?: string;
  orderId?: string;
  [key: string]: unknown;
}

export interface PaycrestWebhookDeliveriesResponse {
  deliveries?: PaycrestWebhookDelivery[];
  items?: PaycrestWebhookDelivery[];
  page?: number;
  pageSize?: number;
  total?: number;
  [key: string]: unknown;
}

export interface PaycrestWebhookRetryResponse {
  [key: string]: unknown;
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  });

  return query.toString();
}

function buildProviderListQuery(params: ProviderListQuery) {
  return buildQuery({
    country: params.country,
    currency: params.currency,
    network: params.network,
    type: params.type,
  });
}

function getStringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function findNestedStringValue(
  data: unknown,
  keys: string[],
): string | undefined {
  const directValue = getStringValue(data);
  if (directValue && keys.includes("__self")) return directValue;

  const queue: unknown[] = [data];
  const visited = new WeakSet<object>();

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (visited.has(current)) continue;
    visited.add(current);

    const record = current as Record<string, unknown>;

    for (const key of keys) {
      const value = getStringValue(record[key]);
      if (value) return value;
    }

    Object.values(record).forEach((value) => {
      if (value && typeof value === "object") {
        queue.push(value);
      }
    });
  }

  return undefined;
}

function normalizeBankVerificationResponse(
  raw: unknown,
  fallback: {
    accountNumber: string;
    bankCode: string;
    bankName?: string;
  },
): BankAccountData {
  const accountName =
    findNestedStringValue(raw, [
      "__self",
      "accountName",
      "account_name",
      "accountHolderName",
      "account_holder_name",
      "accountTitle",
      "account_title",
      "customerName",
      "customer_name",
      "recipientName",
      "recipient_name",
      "verifiedName",
      "verified_name",
      "name",
    ]) || "";

  const accountNumber =
    findNestedStringValue(raw, [
      "accountNumber",
      "account_number",
      "accountIdentifier",
      "account_identifier",
      "number",
    ]) || fallback.accountNumber;

  const bankName =
    findNestedStringValue(raw, [
      "bankName",
      "bank_name",
      "institutionName",
      "institution_name",
      "institution",
    ]) ||
    fallback.bankName ||
    "";

  const bankCode =
    findNestedStringValue(raw, [
      "bankCode",
      "bank_code",
      "institution",
      "institutionCode",
      "institution_code",
      "code",
    ]) || fallback.bankCode;

  return {
    accountName,
    account_name: accountName,
    accountNumber,
    bankName,
    bankCode,
    raw,
  };
}

const PROVIDER_REFERENCE_TTL = 5 * 60 * 1000;
const BANK_DIRECTORY_TTL = 30 * 60 * 1000;

/**
 * --- Provider Service ---
 */
export const providerService = {
  /**
   * GET /api/providers
   * controller: listProviders
   */
  listProviders: async (
    params: ProviderListQuery,
  ): Promise<ApiResponse<PaymentProvider[]>> => {
    const query = buildProviderListQuery(params);
    const endpoint = query ? `/api/providers?${query}` : "/api/providers";

    return getCachedApiResponse(
      `providers:list:${query || "all"}`,
      PROVIDER_REFERENCE_TTL,
      async () => {
        const res = await fetch(endpoint, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        return handleResponse(res);
      },
    );
  },

  /**
   * GET /api/providers/fees
   * controller: getProviderFees
   */
  getProviderFees: async (): Promise<ApiResponse<ProviderFeesResponse>> => {
    return getCachedApiResponse(
      "providers:fees",
      PROVIDER_REFERENCE_TTL,
      async () => {
        const res = await fetch("/api/providers/fees", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        return handleResponse(res);
      },
    );
  },

  /**
   * GET /api/providers/paycrest/rate
   * controller: getPaycrestRate
   */
  getPaycrestRate: async (
    params: PaycrestRateParams,
    signal?: AbortSignal,
  ): Promise<ApiResponse<PaycrestRateResponse>> => {
    const query = buildQuery({
      token: params.token,
      amount: params.amount,
      currency: params.currency,
      network: params.network,
      side: params.side,
    });

    const res = await fetch(`/api/providers/paycrest/rate?${query}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal,
    });
    return handleResponse(res);
  },

  /**
   * POST /api/providers/centiiv/quote
   * controller: getQuoteCentiiv
   */
  getCentiivQuote: async (
    body: CentiivQuoteRequest,
    signal?: AbortSignal,
  ): Promise<ApiResponse<CentiivQuoteResponse>> => {
    const res = await fetch("/api/providers/centiiv/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
      signal,
    });
    return handleResponse(res);
  },

  /**
   * POST /api/providers/centiiv/verify-bank
   * controller: verifyBank
   */
  verifyBank: async (
    body: BankVerificationRequest,
  ): Promise<ApiResponse<BankAccountData>> => {
    const res = await fetch("/api/providers/centiiv/verify-bank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const response = await handleResponse<unknown>(res);
    return {
      ...response,
      data: normalizeBankVerificationResponse(response.data, {
        accountNumber: body.accountNumber,
        bankCode: body.bankCode,
        bankName: body.bankName,
      }),
    };
  },

  /**
   * GET /api/providers/centiiv/banks
   * controller: getBankListsFromCentiiv
   */
  getBankList: async (): Promise<ApiResponse<CentiivBank[]>> => {
    return getCachedApiResponse(
      "providers:centiiv:banks",
      BANK_DIRECTORY_TTL,
      async () => {
        const res = await fetch("/api/providers/centiiv/banks", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        return handleResponse(res);
      },
    );
  },

  /**
   * GET /api/providers/paycrest/institutions/:currency
   * controller: getPaycrestInstitutionsHandler
   */
  getPaycrestInstitutions: async (
    currency: string,
  ): Promise<ApiResponse<PaycrestInstitution[]>> => {
    const normalizedCurrency = currency.toUpperCase();
    return getCachedApiResponse(
      `providers:paycrest:institutions:${normalizedCurrency}`,
      BANK_DIRECTORY_TTL,
      async () => {
        const res = await fetch(
          `/api/providers/paycrest/institutions/${encodeURIComponent(normalizedCurrency)}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          },
        );
        return handleResponse(res);
      },
    );
  },

  /**
   * POST /api/providers/paycrest/verify-account
   * controller: verifyPaycrestAccountHandler
   */
  verifyPaycrestAccount: async (
    body: PaycrestAccountVerificationRequest,
  ): Promise<ApiResponse<PaycrestAccountData>> => {
    const res = await fetch("/api/providers/paycrest/verify-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const response = await handleResponse<unknown>(res);
    return {
      ...response,
      data: normalizeBankVerificationResponse(response.data, {
        accountNumber: body.accountIdentifier,
        bankCode: body.institution,
        bankName: body.bankName,
      }),
    };
  },

  /**
   * GET /api/providers/paycrest/markets
   * controller: getPaycrestMarketsHandler
   */
  getPaycrestMarkets: async (): Promise<ApiResponse<PaycrestMarket[]>> => {
    const res = await fetch("/api/providers/paycrest/markets", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * GET /api/providers/paycrest/webhook-deliveries
   * controller: listPaycrestWebhookDeliveriesHandler
   */
  listPaycrestWebhookDeliveries: async (
    params: PaycrestWebhookDeliveriesQuery = {},
  ): Promise<ApiResponse<PaycrestWebhookDeliveriesResponse>> => {
    const query = buildQuery({
      status: params.status,
      event: params.event,
      orderId: params.orderId,
      page: params.page,
      pageSize: params.pageSize,
    });
    const endpoint = query
      ? `/api/providers/paycrest/webhook-deliveries?${query}`
      : "/api/providers/paycrest/webhook-deliveries";

    const res = await fetch(endpoint, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    return handleResponse(res);
  },

  /**
   * POST /api/providers/paycrest/webhook-deliveries/:id/retry
   * controller: retryPaycrestWebhookDeliveryHandler
   */
  retryPaycrestWebhookDelivery: async (
    id: string,
    sync = true,
  ): Promise<ApiResponse<PaycrestWebhookRetryResponse>> => {
    const query = buildQuery({ sync: String(sync) });
    const res = await fetch(
      `/api/providers/paycrest/webhook-deliveries/${encodeURIComponent(id)}/retry?${query}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      },
    );
    return handleResponse(res);
  },
};
