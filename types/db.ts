// Mirrors the generated DB JSON type used by API metadata payloads.
// Provider metadata is intentionally loose because each provider returns a
// different shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type json = any;

export enum RiskLevel {
  CONSERVATIVE = "CONSERVATIVE",
  MODERATE = "MODERATE",
  AGGRESSIVE = "AGGRESSIVE",
}

export enum PositionStatus {
  ACTIVE = "ACTIVE",
  CLOSED = "CLOSED",
  PENDING = "PENDING",
}

export enum ProviderType {
  ONRAMP = "ONRAMP",
  OFFRAMP = "OFFRAMP",
  BOTH = "BOTH",
}

export enum TransactionType {
  DEPOSIT = "DEPOSIT",
  WITHDRAW = "WITHDRAW",
  BUY = "BUY",
  SELL = "SELL",
  SWAP = "SWAP",
  TRANSFER_IN = "TRANSFER_IN",
  TRANSFER_OUT = "TRANSFER_OUT",
  BRIDGE = "BRIDGE",
}

export enum AssetType {
  FIAT = "FIAT",
  CRYPTO = "CRYPTO",
  RWA = "RWA",
}

export enum TransactionStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
}

export enum InvoiceStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}

export enum ChainType {
  EVM = "EVM",
  STELLAR = "STELLAR",
  SOLANA = "SOLANA",
}

export enum KYCStatus {
  UNVERIFIED = "UNVERIFIED",
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
  UNDER_REVIEW = "UNDER_REVIEW",
  INCOMPLETE = "INCOMPLETE",
}

export interface User {
  id: string;
  privyUserId?: string;
  name?: string | null;
  email?: string | null;
  tag?: string | null;
  image?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  isAdmin?: boolean;
  isActive?: boolean;
  fincraCustomerId?: string | null;
  loginProvider?: string | null;
  assets?: Asset[];
  banks?: BankDetail[];
  chainAccounts?: ChainAccount[];
  devices?: Device[];
  invoices?: Invoice[];
  kyc?: KYC | null;
  merchantProfile?: MerchantProfile | null;
  notifications?: Notification[];
  transactions?: Transaction[];
  virtualAccounts?: VirtualAccount[];
  guardians?: Guardian[];
  guardianOf?: Guardian[];
  recoveryRequests?: RecoveryRequest[];
  cards?: Card[];
  yieldPositions?: YieldPosition[];
}

export interface Device {
  id: string;
  userId: string;
  token: string;
  platform?: string | null;
  brand?: string | null;
  model?: string | null;
  osVersion?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  isActive?: boolean;
  lastUsed?: Date;
  metadata?: json | null;
  createdAt?: Date;
  updatedAt?: Date;
  user?: User;
}

export interface MerchantProfile {
  id: string;
  userId: string;
  businessName?: string;
  businessEmail?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;
  description?: string | null;
  website?: string | null;
  logo?: string | null;
  metadata?: json | null;
  createdAt?: Date;
  updatedAt?: Date;
  user?: User;
}

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  supportedCountries?: string[];
  supportedNetworks?: string[];
  supportedCurrencies?: string[];
  isEnabled?: boolean;
  logo?: string | null;
  metadata?: json | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface VirtualAccount {
  id: string;
  userId: string;
  provider: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  currency: string;
  status: string;
  metadata?: json | null;
  createdAt?: Date;
  updatedAt?: Date;
  user?: User;
}

export interface BankDetail {
  id: string;
  userId?: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankCode?: string | null;
  sortCode?: string | null;
  routingNumber?: string | null;
  swift?: string | null;
  iban?: string | null;
  country?: string | null;
  provider?: string | null;
  createdAt?: Date;
  user?: User;
}

export interface ChainAccount {
  id: string;
  userId: string;
  chain: string;
  chainType?: ChainType;
  publicKey: string;
  smartAccountAddress?: string | null;
  privateKey?: string | null;
  createdAt?: Date;
  user?: User;
}

export interface PendingUser {
  id: string;
  email?: string | null;
  tag?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  migratedAt?: Date | null;
  migratedToUserId?: string | null;
  metadata?: json | null;
  assets?: PendingAsset[];
  chainAccounts?: PendingChainAccount[];
}

export interface PendingChainAccount {
  id: string;
  pendingUserId: string;
  chain: string;
  chainType: ChainType;
  publicKey: string;
  smartAccountAddress: string;
  privateKey: string;
  createdAt?: Date;
  migratedAt?: Date | null;
  pendingUser?: PendingUser;
}

export interface PendingAsset {
  id: string;
  pendingUserId: string;
  symbol: string;
  assetType: AssetType;
  amount: number | string;
  chain?: string | null;
  metadata?: json | null;
  createdAt?: Date;
  updatedAt?: Date;
  migratedAt?: Date | null;
  claimedByUserId?: string | null;
  pendingUser?: PendingUser;
}

export interface Asset {
  id: string;
  userId?: string;
  symbol: string;
  assetType: AssetType;
  amount: number | string;
  chain?: string | null;
  metadata?: json | null;
  createdAt?: Date;
  updatedAt?: Date;
  user?: User;
}

export interface KYC {
  id: string;
  userId: string;
  status: KYCStatus;
  fullName?: string | null;
  nin?: string | null;
  bvn?: string | null;
  documentUrl?: string | null;
  verifiedAt?: Date | null;
  submittedAt?: Date;
  providerUserId?: string | null;
  lastCheckedAt?: Date | null;
  user?: User;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number | string;
  symbol: string;
  assetType: AssetType;
  status: TransactionStatus;
  metadata?: json | null;
  createdAt: Date;
  providerReference?: string | null;
  userOpHash?: string | null;
  executionMethod?: string | null;
  invoice?: Invoice | null;
  user?: User;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  channel: string;
  status: string;
  recipient: string;
  subject?: string | null;
  content?: string | null;
  metadata?: json | null;
  sentAt?: Date | null;
  readAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user?: User;
}

export interface Invoice {
  id: string;
  userId: string;
  amount: number | string;
  symbol: string;
  chain?: string | null;
  assetType: AssetType;
  status: InvoiceStatus;
  description?: string | null;
  reference?: string;
  paymentCode?: string;
  paymentUrl?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  metadata?: json | null;
  expiresAt?: Date | null;
  paidAt?: Date | null;
  transactionId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  transaction?: Transaction | null;
  user?: User;
}

export interface AuditLog {
  id: string;
  action: string;
  actorId?: string | null;
  metadata?: json | null;
  createdAt?: Date;
}

export interface TokenizedAsset {
  id: string;
  symbol: string;
  companyName: string;
  priceNGN: number | string;
  priceUSD: number | string;
  availableSupply: number;
  metadata?: json | null;
  updatedAt?: Date;
}

export interface Guardian {
  id: string;
  userId: string;
  guardianId: string;
  status: string;
  createdAt?: Date;
  user?: User;
  guardian?: User;
}

export interface RecoveryRequest {
  id: string;
  userId: string;
  newOwnerAddress: string;
  chain: string;
  status: string;
  approvals: string[];
  threshold: number;
  createdAt?: Date;
  updatedAt?: Date;
  user?: User;
}

export interface Card {
  id: string;
  userId: string;
  provider: string;
  cardToken: string;
  last4: string;
  expiryMonth: string;
  expiryYear: string;
  brand: string;
  status: string;
  metadata?: json | null;
  createdAt?: Date;
  updatedAt?: Date;
  user?: User;
}

export interface SystemConfig {
  key: string;
  value: string;
  metadata?: json | null;
  updatedAt?: Date;
}

export interface YieldOpportunity {
  id: string;
  protocol: string;
  chain: string;
  symbol: string;
  apy: number | string;
  tvl?: number | string | null;
  riskLevel: RiskLevel;
  isWhitelisted?: boolean;
  metadata?: json | null;
  createdAt?: Date;
  updatedAt?: Date;
  positions?: YieldPosition[];
}

export interface YieldPosition {
  id: string;
  userId: string;
  opportunityId: string;
  amount: number | string;
  entryApy: number | string;
  metadata?: json | null;
  status: PositionStatus;
  createdAt?: Date;
  updatedAt?: Date;
  user?: User;
  opportunity?: YieldOpportunity;
}
