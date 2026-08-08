"use client";

import { useCallback, useMemo, useReducer, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupportedChainsForToken } from "@/lib/chains";

export type WithdrawStep = "asset" | "amount" | "provider" | "bank" | "review";

export const WITHDRAW_STEPS: WithdrawStep[] = [
  "asset",
  "amount",
  "provider",
  "bank",
  "review",
];

type State = {
  step: WithdrawStep;
  asset: string | null;
  networkName: string | null;
  networkId: string | null;
  amount: string;
  currency: string | null;
  country: string | null;
  countrySource: "auto" | "manual" | null;
  providerId: string | null;
  bankId: string | null;
};

type Action =
  | { type: "SET_STEP"; step: WithdrawStep }
  | { type: "SET_ASSET"; asset: string }
  | { type: "SET_ASSET_AND_NETWORK"; asset: string; name: string; id: string }
  | { type: "SET_NETWORK"; name: string; id: string }
  | { type: "SET_AMOUNT"; amount: string }
  | {
      type: "SET_COUNTRY_AND_CURRENCY";
      country: string;
      currency: string;
      source: "auto" | "manual";
    }
  | { type: "SET_PROVIDER"; providerId: string }
  | { type: "SET_BANK"; bankId: string | null }
  | { type: "SYNC_FROM_URL"; params: URLSearchParams };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_STEP":
      return action.step === state.step
        ? state
        : { ...state, step: action.step };
    case "SET_ASSET":
      return action.asset === state.asset
        ? state
        : {
            ...state,
            asset: action.asset,
            networkName: null,
            networkId: null,
            providerId: null,
          };
    case "SET_ASSET_AND_NETWORK":
      if (
        action.asset === state.asset &&
        action.name === state.networkName &&
        action.id === state.networkId &&
        state.providerId === null
      ) {
        return state;
      }
      return {
        ...state,
        asset: action.asset,
        networkName: action.name,
        networkId: action.id,
        amount: "",
        providerId: null,
        bankId: null,
      };
    case "SET_NETWORK":
      return action.name === state.networkName
        ? state
        : {
            ...state,
            networkName: action.name,
            networkId: action.id,
            providerId: null,
          };
    case "SET_AMOUNT":
      return action.amount === state.amount
        ? state
        : { ...state, amount: action.amount };
    case "SET_COUNTRY_AND_CURRENCY":
      if (
        action.country === state.country &&
        action.currency === state.currency &&
        action.source === state.countrySource
      ) {
        return state;
      }
      return {
        ...state,
        country: action.country,
        currency: action.currency,
        countrySource: action.source,
      };
    case "SET_PROVIDER":
      return action.providerId === state.providerId
        ? state
        : { ...state, providerId: action.providerId, bankId: null };
    case "SET_BANK":
      return action.bankId === state.bankId
        ? state
        : { ...state, bankId: action.bankId };
    case "SYNC_FROM_URL": {
      const urlStep = (action.params.get("step") as WithdrawStep) || "asset";
      const urlAsset = action.params.get("asset") || null;
      const urlNetwork = action.params.get("network");
      const urlAmount = action.params.get("amount") || "";
      const urlCurrency = action.params.get("currency");
      const urlCountry = action.params.get("country") || null;
      const urlCountrySource =
        (action.params.get("countrySource") as "auto" | "manual" | null) ||
        null;
      const urlProviderId = action.params.get("providerId");
      const urlBankId = action.params.get("bankId");

      let urlNetworkId: string | null = null;
      if (urlNetwork && urlAsset) {
        const chains = getSupportedChainsForToken(urlAsset as "USDC" | "USDT");
        const chain = chains.find(
          (c) => c.name.toLowerCase() === urlNetwork.toLowerCase(),
        );
        urlNetworkId = chain?.id.toString() || null;
      }

      return {
        step: urlStep,
        asset: urlAsset,
        networkName: urlNetwork,
        networkId: urlNetworkId,
        amount: urlAmount,
        currency: urlCurrency,
        country: urlCountry,
        countrySource: urlCountrySource,
        providerId: urlProviderId,
        bankId: urlBankId,
      };
    }
    default:
      return state;
  }
}

export function useWithdrawState() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialState = useMemo<State>(() => {
    const urlStep = (searchParams.get("step") as WithdrawStep) || "asset";
    const urlAsset = searchParams.get("asset") || null;
    const urlNetwork = searchParams.get("network");
    const urlAmount = searchParams.get("amount") || "";
    const urlCurrency = searchParams.get("currency");
    const urlCountry = searchParams.get("country") || null;
    const urlCountrySource =
      (searchParams.get("countrySource") as "auto" | "manual" | null) || null;
    const urlProviderId = searchParams.get("providerId");
    const urlBankId = searchParams.get("bankId");

    let urlNetworkId: string | null = null;
    if (urlNetwork && urlAsset) {
      const chains = getSupportedChainsForToken(urlAsset as "USDC" | "USDT");
      const chain = chains.find(
        (c) => c.name.toLowerCase() === urlNetwork.toLowerCase(),
      );
      urlNetworkId = chain?.id.toString() || null;
    }

    return {
      step: urlStep,
      asset: urlAsset,
      networkName: urlNetwork,
      networkId: urlNetworkId,
      amount: urlAmount,
      currency: urlCurrency,
      country: urlCountry,
      countrySource: urlCountrySource,
      providerId: urlProviderId,
      bankId: urlBankId,
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    dispatch({ type: "SYNC_FROM_URL", params: searchParams });
  }, [searchParams]);

  const updateUrl = useCallback(
    (updates: Record<string, string | null>, replace = false) => {
      const params = new URLSearchParams(searchParams.toString());
      let changed = false;
      Object.entries(updates).forEach(([key, value]) => {
        const current = params.get(key);
        if (value === null && current !== null) {
          params.delete(key);
          changed = true;
        } else if (value !== null && current !== value) {
          params.set(key, value);
          changed = true;
        }
      });
      if (!changed) return;
      const url = `?${params.toString()}`;
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [router, searchParams],
  );

  const setStep = useCallback(
    (step: WithdrawStep) => {
      dispatch({ type: "SET_STEP", step });
      updateUrl({ step });
    },
    [updateUrl],
  );

  const setAsset = useCallback(
    (asset: string) => {
      dispatch({ type: "SET_ASSET", asset });
      updateUrl({ asset, network: null, providerId: null, bankId: null });
    },
    [updateUrl],
  );

  const setNetwork = useCallback(
    (name: string, id: string) => {
      dispatch({ type: "SET_NETWORK", name, id });
      updateUrl({ network: name, providerId: null, bankId: null });
    },
    [updateUrl],
  );

  const setAssetAndNetwork = useCallback(
    (asset: string, name: string, id: string) => {
      dispatch({ type: "SET_ASSET_AND_NETWORK", asset, name, id });
      updateUrl({
        asset,
        network: name,
        amount: null,
        providerId: null,
        bankId: null,
      });
    },
    [updateUrl],
  );

  const setAmount = useCallback(
    (amount: string) => {
      dispatch({ type: "SET_AMOUNT", amount });
      updateUrl({ amount }, true);
    },
    [updateUrl],
  );

  const setCountryAndCurrency = useCallback(
    (country: string, currency: string, source: "auto" | "manual" = "auto") => {
      dispatch({
        type: "SET_COUNTRY_AND_CURRENCY",
        country,
        currency,
        source,
      });
      updateUrl({ country, currency, countrySource: source }, true);
    },
    [updateUrl],
  );

  const setProviderId = useCallback(
    (providerId: string) => {
      dispatch({ type: "SET_PROVIDER", providerId });
      updateUrl({ providerId, bankId: null });
    },
    [updateUrl],
  );

  const setBankId = useCallback(
    (bankId: string | null) => {
      dispatch({ type: "SET_BANK", bankId });
      updateUrl({ bankId }, true);
    },
    [updateUrl],
  );

  return {
    ...state,
    setStep,
    setAsset,
    setAssetAndNetwork,
    setNetwork,
    setAmount,
    setCountryAndCurrency,
    setProviderId,
    setBankId,
  };
}
