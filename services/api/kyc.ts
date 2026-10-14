import { ApiResponse, apiFetch, handleResponse } from "./index";

export type KycDocumentType =
  | "PASSPORT"
  | "NATIONAL_ID"
  | "DRIVER_LICENSE"
  | "BVN";
export type KycField =
  | "country"
  | "fullName"
  | "dateOfBirth"
  | "document"
  | "phone";

export interface KycDocumentRule {
  type: KycDocumentType;
  label: string;
  pattern: string;
  hint: string;
  issuerCountries: string[];
}

export interface KycRequirements {
  country: string;
  documents: KycDocumentRule[];
  phone: { required: boolean; pattern: string; hint: string };
  minimumAge: number;
}

export interface KycProfile {
  status: string;
  fullName: string | null;
  dateOfBirth: string | null;
  country: string | null;
  phoneE164: string | null;
  documents: { type: KycDocumentType; issuerCountry: string; last4: string }[];
}

export interface KycProfileResult {
  profile: KycProfile;
  requirements?: KycRequirements;
  missing?: KycField[];
}

export interface KycProfileInput {
  fullName?: string;
  dateOfBirth?: string;
  country?: string;
  phoneE164?: string | null;
  document?: { type: KycDocumentType; issuerCountry: string; number: string };
}

/** A provider refused the payment until identity details are completed. */
export interface KycRequiredDetails {
  country: string;
  missing: KycField[];
  message: string;
}

export function kycRequiredFrom(error: unknown): KycRequiredDetails | null {
  const err = error as { code?: string; body?: Record<string, unknown> };
  if (err?.code !== "KYC_REQUIRED") return null;
  const body = err.body ?? {};
  return {
    country: typeof body.country === "string" ? body.country : "",
    missing: Array.isArray(body.missing) ? (body.missing as KycField[]) : [],
    message: typeof body.message === "string" ? body.message : "",
  };
}

const json = { "Content-Type": "application/json" };

export const kycService = {
  getProfile: async (
    country?: string,
  ): Promise<ApiResponse<KycProfileResult>> => {
    const query = country ? `?country=${encodeURIComponent(country)}` : "";
    const res = await apiFetch(
      `/api/kyc/profile${query}`,
      { method: "GET", headers: json },
      { signed: true },
    );
    return handleResponse(res);
  },

  saveProfile: async (
    input: KycProfileInput,
  ): Promise<ApiResponse<KycProfileResult>> => {
    const res = await apiFetch(
      "/api/kyc/profile",
      { method: "PUT", headers: json, body: JSON.stringify(input) },
      { signed: true },
    );
    return handleResponse(res);
  },

  getRequirements: async (
    country: string,
  ): Promise<ApiResponse<KycRequirements>> => {
    const res = await apiFetch(
      `/api/kyc/requirements?country=${encodeURIComponent(country)}`,
      { method: "GET", headers: json },
    );
    return handleResponse(res);
  },
};
