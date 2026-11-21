import { apiFetch, handleResponse, type ApiResponse } from "./index";
import type { CardVerification, FundingOrder } from "./cards";

export type GiftOrderStatus =
  | "AWAITING_PAYMENT"
  | "EXPIRED"
  | "PAID"
  | "PROCESSING"
  | "SUBMITTED"
  | "HELD"
  | "PAYOUT_PENDING"
  | "PAYOUT_SENT"
  | "COMPLETED"
  | "REFUNDED"
  | "FAILED"
  | "NEEDS_REVIEW";

export interface GiftProgram {
  enabled: boolean;
  buyEnabled: boolean;
  sellEnabled: boolean;
  eligibility: string | null;
  limits: {
    minBuyUsd: number;
    maxBuyUsd: number;
    dailyBuyLimitUsd: number;
    maxSellUsd: number;
    dailySellLimitUsd: number;
  };
  countries: string[];
  funding: { chains: string[]; assets: string[] };
  payout: { chains: string[]; asset: string; assets: string[] };
}

export interface GiftProduct {
  sku: string;
  title: string;
  imageUrl?: string | null;
  currency: string;
  country?: string | null;
  fixedPrices: number[];
  minPrice?: number | null;
  maxPrice?: number | null;
}

export interface GiftBuyQuote {
  sku: string;
  unitPrice: number;
  quantity: number;
  faceValue: number;
  rate: number;
  providerUsd: string;
  kellonFeeUsd: string;
  totalUsd: string;
  chain: string;
  asset: string;
  product: GiftProduct | null;
}

export interface GiftSellCardType {
  id: string;
  name: string;
  form?: string | null;
  country?: string | null;
  terms?: string | null;
  minAmount?: number | null;
  usdRate: number;
  currency: string;
}

export interface GiftSellQuote {
  estimatedUsd: string;
  kellonFeeUsd: string;
  owedUsd: string;
  estimatedPayoutUsd: string;
  cardType: GiftSellCardType;
  amount: number;
  payoutChain: string;
  payoutAsset: string;
}

export interface GiftOrder {
  id: string;
  type: "GIFTCARD_BUY" | "GIFTCARD_SELL";
  side: "BUY" | "SELL";
  status: GiftOrderStatus;
  amountUsd: string;
  kellonFeeUsd: string;
  owedUsd: string;
  totalUsd: string;
  payoutUsd: string | null;
  chain: string | null;
  asset: string | null;
  fundingTxHash: string | null;
  payoutTxHash: string | null;
  error: string | null;
  createdAt: string;
  giftCard: {
    sku: string | null;
    title: string | null;
    imageUrl: string | null;
    cardCurrency: string | null;
    unitPrice: number | null;
    quantity: number | null;
    cardAmount: number | null;
    estimatedUsd: string | null;
    creditedUsd: string | null;
    providerStatus: string | null;
    reason: string | null;
    codesReady: boolean;
  };
}

export interface GiftCode {
  cardNumber: string | null;
  pin: string | null;
  claimUrl: string | null;
  expiryDate: string | null;
}

export interface GiftBuyInput {
  sku: string;
  unitPrice: number;
  quantity: number;
  chain: string;
  asset: string;
}
export interface GiftSellInput {
  categoryId: string;
  cardTypeId: string;
  amount: number;
  payoutChain?: string;
  images?: string[];
  comments?: string;
}

export const isFinalGiftOrder = (status: GiftOrderStatus) =>
  [
    "COMPLETED",
    "REFUNDED",
    "FAILED",
    "EXPIRED",
    "NEEDS_REVIEW",
    "SUBMITTED",
    "HELD",
  ].includes(status);

const get = async <T>(path: string): Promise<ApiResponse<T>> =>
  handleResponse<T>(await apiFetch(`/api/giftcards${path}`, { method: "GET" }));

const post = async <T>(
  path: string,
  body: unknown = {},
): Promise<ApiResponse<T>> =>
  handleResponse<T>(
    await apiFetch(`/api/giftcards${path}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

export const giftCardsService = {
  getProgram: () => get<GiftProgram>("/program"),
  products: () => get<GiftProduct[]>("/products"),
  quoteBuy: (input: GiftBuyInput) => post<GiftBuyQuote>("/buy/quote", input),
  buy: (input: GiftBuyInput) => post<FundingOrder>("/buy", input),
  confirmPayment: (orderId: string, txHash: string) =>
    post<GiftOrder>(`/orders/${orderId}/confirm`, { txHash }),
  sellCategories: () =>
    get<{ id: string; name: string; image?: string | null }[]>(
      "/sell/categories",
    ),
  sellCardTypes: (categoryId: string) =>
    get<GiftSellCardType[]>(
      `/sell/categories/${encodeURIComponent(categoryId)}/card-types`,
    ),
  quoteSell: (input: Omit<GiftSellInput, "images" | "comments">) =>
    post<GiftSellQuote>("/sell/quote", input),
  sell: (input: GiftSellInput, verification?: CardVerification) =>
    post<GiftOrder>("/sell", { ...input, ...verification }),
  orders: () => get<GiftOrder[]>("/orders"),
  order: (orderId: string) => get<GiftOrder>(`/orders/${orderId}`),
  codes: (orderId: string, verification?: CardVerification) =>
    post<GiftCode[]>(`/orders/${orderId}/codes`, { ...verification }),
};
