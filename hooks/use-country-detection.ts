import { useEffect } from "react";
import { useDetectCountry } from "@/hooks/use-detect-country";

export function useCountryDetection(
  urlCountry: string | null,
  countrySource: "auto" | "manual" | null,
  onCountryDetected: (country: string, currency: string) => void,
) {
  const hasManualCountry = countrySource === "manual" && Boolean(urlCountry);
  const { countryCode, currencyCode, isDetecting } = useDetectCountry(
    hasManualCountry ? urlCountry : null,
  );

  useEffect(() => {
    // A manual choice is already written by the caller. Ignore any stale
    // automatic result that resolves while the user is selecting a country.
    if (hasManualCountry) {
      return;
    }

    if (!countryCode || !currencyCode) {
      return;
    }

    onCountryDetected(countryCode, currencyCode);
  }, [countryCode, currencyCode, hasManualCountry, onCountryDetected]);

  return { isDetecting };
}
