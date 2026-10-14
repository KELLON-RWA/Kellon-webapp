import { useCallback, useEffect, useState } from "react";
import {
  kycService,
  type KycField,
  type KycProfile,
  type KycProfileInput,
  type KycRequirements,
} from "@/services/api/kyc";

/** Identity details for the user, with what a given country's payments still need. */
export function useKyc(country?: string, enabled = true) {
  const [profile, setProfile] = useState<KycProfile | null>(null);
  const [requirements, setRequirements] = useState<KycRequirements | null>(
    null,
  );
  const [missing, setMissing] = useState<KycField[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await kycService.getProfile(country);
      setProfile(data.profile);
      setRequirements(data.requirements ?? null);
      setMissing(data.missing ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [country]);

  useEffect(() => {
    if (enabled) refresh().catch(() => {});
  }, [enabled, refresh]);

  const loadRequirements = useCallback(async (target: string) => {
    const { data } = await kycService.getRequirements(target);
    setRequirements(data);
    return data;
  }, []);

  /** Saves the changes; resolves to the missing fields for the country (empty when complete). */
  const save = useCallback(
    async (input: KycProfileInput): Promise<KycField[]> => {
      setIsSaving(true);
      try {
        await kycService.saveProfile(input);
        const { data } = await kycService.getProfile(country ?? input.country);
        setProfile(data.profile);
        setRequirements(data.requirements ?? null);
        setMissing(data.missing ?? []);
        return data.missing ?? [];
      } finally {
        setIsSaving(false);
      }
    },
    [country],
  );

  return {
    profile,
    requirements,
    missing,
    isComplete: !isLoading && !!requirements && missing.length === 0,
    isLoading,
    isSaving,
    refresh,
    loadRequirements,
    save,
  };
}
