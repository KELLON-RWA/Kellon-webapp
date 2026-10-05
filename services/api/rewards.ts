import { apiFetch, handleResponse } from "."

export interface RewardsSummary {
  program: { code: string; name: string; unit: string; valuationAsset: string; pointsPerUsd: string }
  balance: string
  lifetimeEarned: string
  lifetimeRedeemed: string
  referrals: ReferralSummary
}

export interface ReferralSummary {
  code: string
  link: string
  clicks: number
  conversions: number
  total: number
  qualified: number
  aliases: Array<{ id: string; kind: string; label?: string; active: boolean; createdAt: string }>
}

export interface RewardCatalogItem {
  code: string
  name: string
  description?: string
  kind: string
  costPoints: string
  valueAmount?: string | null
  valueAsset?: string | null
}

export interface RewardLedgerEntry {
  id: string
  delta: string
  type: string
  source?: string
  balanceAfter?: string
  createdAt: string
}

const getSummary = async (): Promise<RewardsSummary> => {
  const res = await apiFetch("/api/rewards")
  return (await handleResponse<RewardsSummary>(res)).data
}

const getLedger = async (limit = 25, offset = 0): Promise<{ entries: RewardLedgerEntry[]; total: number }> => {
  const res = await apiFetch(`/api/rewards/ledger?limit=${limit}&offset=${offset}`)
  return (await handleResponse<{ entries: RewardLedgerEntry[]; total: number }>(res)).data
}

const getCatalog = async (): Promise<RewardCatalogItem[]> => {
  const res = await apiFetch("/api/rewards/catalog")
  return (await handleResponse<RewardCatalogItem[]>(res)).data
}

const redeem = async (itemCode: string): Promise<{ id: string; status: string; itemCode: string }> => {
  const res = await apiFetch("/api/rewards/redeem", { method: "POST", body: JSON.stringify({ itemCode }) })
  return (await handleResponse<{ id: string; status: string; itemCode: string }>(res)).data
}

const attributeReferral = async (code: string): Promise<void> => {
  const res = await apiFetch("/api/rewards/referrals/attribute", { method: "POST", body: JSON.stringify({ code }) })
  await handleResponse(res)
}

export const rewardsService = {
  getSummary,
  getLedger,
  getCatalog,
  redeem,
  attributeReferral,
}
