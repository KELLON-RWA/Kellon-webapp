import { apiFetch, handleResponse, type ApiResponse } from "./index";

export type CardStatus = "ACTIVE" | "FROZEN" | "INACTIVE" | "TERMINATED";
export type HolderStatus =
  | "NOT_SUBMITTED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";
export type CardOperationStatus =
  | "AWAITING_PAYMENT"
  | "EXPIRED"
  | "PAID"
  | "PROCESSING"
  | "PAYOUT_PENDING"
  | "PAYOUT_SENT"
  | "COMPLETED"
  | "FAILED"
  | "NEEDS_REVIEW";

export interface VirtualCard {
  id: string;
  brand: string;
  last4: string;
  maskedNumber: string;
  currency: string;
  status: CardStatus;
  balance: number | null;
  balanceUpdatedAt: string | null;
  createdAt: string;
  terminatedAt: string | null;
  withdrawableBalance?: number | null;
}

export interface CardSecrets {
  cardNumber: string;
  cvv: string;
  expiry: string;
  nameOnCard: string;
  billingAddress?: {
    line1?: string;
    line2?: string | null;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export interface HolderAddress {
  line1: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  houseNumber?: string;
}

export interface CardHolder {
  status: HolderStatus;
  reason: string | null;
  verificationLink: string | null;
  address: HolderAddress | null;
}

export interface CardProgram {
  enabled: boolean;
  issuanceEnabled: boolean;
  topupEnabled: boolean;
  withdrawEnabled: boolean;
  limits: {
    minFundingUsd: number;
    maxFundingUsd: number;
    dailyFundingLimitUsd: number;
    maxCards: number;
    minWithdrawUsd?: number;
  };
  currency?: string;
  brands: string[];
  defaultBrand: string;
  countries: string[];
  funding: { chains: string[]; assets: string[] };
  payout: { chains: string[]; asset: string; assets?: string[] };
  pricing: {
    cardCreationFee: number;
    fundCardFeeValue: number;
    fundFeePercent: number;
    fundFeePercentThreshold: number;
    terminationFee: number;
    declineFee: number;
  } | null;
  holder: CardHolder | null;
}

export interface CardQuote {
  type: string;
  amountUsd: string;
  providerFeeUsd: string;
  kellonFeeUsd: string;
  owedUsd: string;
  totalUsd: string;
  payoutUsd?: string;
}

export interface CardOperation {
  id: string;
  type: "ISSUE" | "TOPUP" | "WITHDRAW" | "REFUND";
  status: CardOperationStatus;
  cardId: string | null;
  amountUsd: string;
  totalUsd: string;
  payoutUsd: string | null;
  chain: string | null;
  asset: string | null;
  fundingTxHash: string | null;
  payoutTxHash: string | null;
  error: string | null;
  createdAt: string;
}

export interface FundingOrder {
  operation: CardOperation;
  quote: CardQuote;
  payment: {
    chain: string;
    asset: string;
    to: string;
    amount: string;
    from: string;
  };
  calls: { to: string; data: string; value: string }[];
}

export interface CardActivity {
  id: string;
  type: string;
  status: string | null;
  amount: number | null;
  currency: string;
  merchantName: string | null;
  merchantCountry: string | null;
  description: string | null;
  balanceAfter: number | null;
  time: string | null;
}

export interface CardVerification {
  verificationCode: string;
  verificationType: "email_otp" | "sms_otp" | "totp";
}

export const CARD_CHAIN_LABELS: Record<string, string> = {
  base: "Base",
  bnb: "BNB Chain",
  polygon: "Polygon",
  celo: "Celo",
};

export const isFinalCardOperation = (status: CardOperationStatus) =>
  ["COMPLETED", "FAILED", "EXPIRED", "NEEDS_REVIEW"].includes(status);

const get = async <T>(path: string): Promise<ApiResponse<T>> =>
  handleResponse<T>(await apiFetch(`/api/cards${path}`, { method: "GET" }));

const post = async <T>(
  path: string,
  body: unknown = {},
): Promise<ApiResponse<T>> =>
  handleResponse<T>(
    await apiFetch(`/api/cards${path}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

export const cardsService = {
  getProgram: () => get<CardProgram>("/program"),
  getHolder: (refresh = false) =>
    get<CardHolder>(`/holder${refresh ? "?refresh=true" : ""}`),
  submitHolder: (address: HolderAddress, phone?: string) =>
    post<CardHolder>("/holder", { address, phone }),
  quote: (input: {
    type: "ISSUE" | "TOPUP" | "WITHDRAW";
    amount: number;
    chain?: string;
    asset?: string;
  }) => post<CardQuote>("/quote", input),
  issue: (input: {
    amount: number;
    chain: string;
    asset: string;
    brand: string;
  }) => post<FundingOrder>("", input),
  topUp: (
    cardId: string,
    input: { amount: number; chain: string; asset: string },
  ) => post<FundingOrder>(`/${cardId}/top-up`, input),
  confirmPayment: (operationId: string, txHash: string) =>
    post<CardOperation>(`/operations/${operationId}/confirm`, { txHash }),
  getOperation: (operationId: string) =>
    get<CardOperation>(`/operations/${operationId}`),
  list: () => get<VirtualCard[]>(""),
  get: (cardId: string) => get<VirtualCard>(`/${cardId}`),
  activity: (cardId: string, page = 1) =>
    get<{ items: CardActivity[]; page: number; total: number }>(
      `/${cardId}/transactions?page=${page}&limit=20`,
    ),
  withdraw: (
    cardId: string,
    input: { amount: number; chain: string },
    verification?: CardVerification,
  ) =>
    post<CardOperation>(`/${cardId}/withdraw`, { ...input, ...verification }),
  freeze: (cardId: string) => post<VirtualCard>(`/${cardId}/freeze`),
  unfreeze: (cardId: string, verification?: CardVerification) =>
    post<VirtualCard>(`/${cardId}/unfreeze`, { ...verification }),
  terminate: (cardId: string, verification?: CardVerification) =>
    post<VirtualCard>(`/${cardId}/terminate`, { ...verification }),
  reveal: (cardId: string, verification?: CardVerification) =>
    post<CardSecrets>(`/${cardId}/reveal`, { ...verification }),
};
