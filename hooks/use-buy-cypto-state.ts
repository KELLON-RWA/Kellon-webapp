// hooks/useBuyCryptoState.ts
import { useCallback, useMemo, useReducer, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupportedChainsForToken } from "@/lib/chains";

export type Step = "asset" | "amount" | "provider" | "bank" | "review";
export const STEPS: Step[] = ["asset", "amount", "provider", "bank", "review"];

type State = {
  step: Step;
  asset: string | null;
  networkName: string | null;
  networkId: string | null;
  amount: string;
  currency: string | null;
  country: string | null;
  countrySource: "auto" | "manual" | null;
  bankId: string | null;
};

type Action =
  | { type: "SET_STEP"; step: Step }
  | { type: "SET_ASSET"; asset: string }
  | { type: "SET_NETWORK"; name: string; id: string }
  | { type: "SET_AMOUNT"; amount: string }
  | {
      type: "SET_COUNTRY_AND_CURRENCY";
      country: string;
      currency: string;
      source: "auto" | "manual";
    }
  | { type: "SET_BANK"; bankId: string | null }
  | { type: "SYNC_FROM_URL"; params: URLSearchParams };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_STEP":
      if (action.step === state.step) return state;
      return { ...state, step: action.step };

    case "SET_ASSET":
      if (action.asset === state.asset) return state;
      // Reset network when asset changes
      return {
        ...state,
        asset: action.asset,
        networkName: null,
        networkId: null,
        bankId: null,
      };

    case "SET_NETWORK":
      if (action.name === state.networkName) return state;
      return {
        ...state,
        networkName: action.name,
        networkId: action.id,
        bankId: null,
      };

    case "SET_AMOUNT":
      if (action.amount === state.amount) return state;
      return { ...state, amount: action.amount };

    case "SET_COUNTRY_AND_CURRENCY":
      if (
        action.country === state.country &&
        action.currency === state.currency &&
        action.source === state.countrySource
      )
        return state;
      return {
        ...state,
        country: action.country,
        currency: action.currency,
        countrySource: action.source,
      };

    case "SET_BANK":
      if (action.bankId === state.bankId) return state;
      return { ...state, bankId: action.bankId };

    case "SYNC_FROM_URL": {
      const urlStep = (action.params.get("step") as Step) || "asset";
      const urlAsset = action.params.get("asset") || "USDC";
      const urlNetwork = action.params.get("network");
      const urlAmount = action.params.get("amount") || "";
      const urlCurrency = action.params.get("currency");
      const urlCountry = action.params.get("country") || null;
      const urlCountrySource =
        (action.params.get("countrySource") as "auto" | "manual" | null) ||
        null;
      const urlBankId = action.params.get("bankId");

      let urlNetworkId: string | null = null;
      if (urlNetwork && urlAsset) {
        const chains = getSupportedChainsForToken(urlAsset as "USDC" | "USDT");
        const chain = chains.find(
          (c) => c.name.toLowerCase() === urlNetwork.toLowerCase(),
        );
        urlNetworkId = chain?.id.toString() || null;
      }

      const newState = {
        step: urlStep,
        asset: urlAsset,
        networkName: urlNetwork,
        networkId: urlNetworkId,
        amount: urlAmount,
        currency: urlCurrency,
        country: urlCountry,
        countrySource: urlCountrySource,
        bankId: urlBankId,
      };

      // Shallow compare – update only if something changed
      if (
        newState.step === state.step &&
        newState.asset === state.asset &&
        newState.networkName === state.networkName &&
        newState.networkId === state.networkId &&
        newState.amount === state.amount &&
        newState.currency === state.currency &&
        newState.country === state.country &&
        newState.countrySource === state.countrySource &&
        newState.bankId === state.bankId
      ) {
        return state;
      }
      return newState;
    }

    default:
      return state;
  }
}

export function useBuyCryptoState() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // One‑time initial state from URL (on mount)
  const initialState = useMemo<State>(() => {
    const urlStep = (searchParams.get("step") as Step) || "asset";
    const urlAsset = searchParams.get("asset") || "USDC";
    const urlNetwork = searchParams.get("network");
    const urlAmount = searchParams.get("amount") || "";
    const urlCurrency = searchParams.get("currency");
    const urlCountry = searchParams.get("country") || null;
    const urlCountrySource =
      (searchParams.get("countrySource") as "auto" | "manual" | null) || null;
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
      bankId: urlBankId,
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);

  // Keep a synchronous copy of the latest flow state. Router updates are
  // asynchronous, so useSearchParams can still describe the previous step
  // when a user selects a network and immediately continues.
  useEffect(() => {
    const action: Action = { type: "SYNC_FROM_URL", params: searchParams };
    stateRef.current = reducer(stateRef.current, action);
    dispatch(action);
  }, [searchParams]);

  // Persist a complete flow snapshot, rather than layering a partial update on
  // top of a potentially stale URL. This keeps asset, network and step in
  // lockstep during fast selections and navigation.
  const writeStateToUrl = useCallback(
    (nextState: State, replace = false) => {
      const params = new URLSearchParams(searchParams.toString());
      const values: Record<string, string | null> = {
        step: nextState.step,
        asset: nextState.asset,
        network: nextState.networkName,
        amount: nextState.amount || null,
        currency: nextState.currency,
        country: nextState.country,
        countrySource: nextState.countrySource,
        bankId: nextState.bankId,
      };

      Object.entries(values).forEach(([key, value]) => {
        const current = params.get(key);
        if (value === null && current !== null) {
          params.delete(key);
        } else if (value !== null && current !== value) {
          params.set(key, value);
        }
      });
      const url = `?${params.toString()}`;
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [router, searchParams],
  );

  const applyAction = useCallback(
    (action: Exclude<Action, { type: "SYNC_FROM_URL" }>, replace = false) => {
      const nextState = reducer(stateRef.current, action);
      stateRef.current = nextState;
      dispatch(action);
      writeStateToUrl(nextState, replace);
    },
    [writeStateToUrl],
  );

  // Stable action creators
  const setStep = useCallback(
    (step: Step) => {
      if (step === stateRef.current.step) return;
      applyAction({ type: "SET_STEP", step });
    },
    [applyAction],
  );

  const setAsset = useCallback(
    (asset: string) => {
      if (asset === stateRef.current.asset) return;
      applyAction({ type: "SET_ASSET", asset });
    },
    [applyAction],
  );

  const setNetwork = useCallback(
    (name: string, id: string) => {
      if (name === stateRef.current.networkName) return;
      applyAction({ type: "SET_NETWORK", name, id });
    },
    [applyAction],
  );

  const setAmount = useCallback(
    (amount: string) => {
      if (amount === stateRef.current.amount) return;
      applyAction({ type: "SET_AMOUNT", amount }, true);
    },
    [applyAction],
  );

  const setCountryAndCurrency = useCallback(
    (country: string, currency: string, source: "auto" | "manual" = "auto") => {
      if (country === stateRef.current.country &&
        currency === stateRef.current.currency &&
        source === stateRef.current.countrySource)
        return;
      applyAction({
        type: "SET_COUNTRY_AND_CURRENCY",
        country,
        currency,
        source,
      }, true);
    },
    [applyAction],
  );

  const setBankId = useCallback(
    (bankId: string | null) => {
      if (bankId === stateRef.current.bankId) return;
      applyAction({ type: "SET_BANK", bankId }, true);
    },
    [applyAction],
  );

  return {
    step: state.step,
    asset: state.asset,
    networkName: state.networkName,
    networkId: state.networkId,
    amount: state.amount,
    currency: state.currency,
    country: state.country,
    countrySource: state.countrySource,
    bankId: state.bankId,
    setAsset,
    setNetwork,
    setAmount,
    setCountryAndCurrency, // replaces individual setCountry/setCurrency
    setBankId,
    setStep,
  };
}
