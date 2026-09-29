"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { RealtimeClient } from "@/lib/realtime/client";
import {
  planInvalidation,
  RECONNECT_INVALIDATION,
  type InvalidationPlan,
} from "@/lib/realtime/invalidation-map";
import { getAuthToken } from "@/services/api";

interface RealtimeContextValue {
  /** Screens gate their fallback polling on this. */
  isConnected: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  isConnected: false,
});

export const useRealtime = () => useContext(RealtimeContext);

const ROUTER_REFRESH_DEBOUNCE_MS = 1_000;
const ROUTER_REFRESH_MIN_INTERVAL_MS = 30_000;
const STABLE_AFTER_MS = 30_000;

export default function RealtimeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRouterRefreshAt = useRef(0);
  const stableTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasConnected = useRef(false);

  useEffect(() => {
    if (!getAuthToken()) return;

    // Trailing debounce plus a cooldown: a burst or reconnect flap must not
    // turn into a stream of full RSC requests to the backend.
    const applyPlan = (plan: InvalidationPlan) => {
      for (const key of plan.queryKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      if (plan.refreshRouter && !refreshTimer.current) {
        const elapsed = Date.now() - lastRouterRefreshAt.current;
        const delay = Math.max(
          ROUTER_REFRESH_DEBOUNCE_MS,
          ROUTER_REFRESH_MIN_INTERVAL_MS - elapsed,
        );
        refreshTimer.current = setTimeout(() => {
          refreshTimer.current = null;
          lastRouterRefreshAt.current = Date.now();
          router.refresh();
        }, delay);
      }
    };

    const client = new RealtimeClient({
      onEvent: (event) => applyPlan(planInvalidation(event)),
      onConnected: () => {
        setIsConnected(true);
        // The initial RSC response is already a fresh snapshot. A router refresh
        // here immediately duplicated the profile request and delayed first paint.
        // Reconnects only invalidate client data. Forcing an RSC refresh here
        // caused a full page request for every unstable socket reconnect.
        if (hasConnected.current) {
          applyPlan(RECONNECT_INVALIDATION);
        }
        hasConnected.current = true;
        if (stableTimer.current) clearTimeout(stableTimer.current);
        stableTimer.current = setTimeout(
          () => client.markStable(),
          STABLE_AFTER_MS,
        );
      },
      onDisconnected: () => setIsConnected(false),
    });

    client.start();

    // A push that arrives while a tab is open goes through the same invalidation path,
    // so the socket and push transports converge on one handler.
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.source !== "kellon-push") return;
      const raw = event.data?.data?.kellonEvent;
      if (typeof raw !== "string") return;
      try {
        applyPlan(planInvalidation(JSON.parse(raw)));
      } catch {
        /* malformed envelope — ignore */
      }
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);

    return () => {
      client.stop();
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (stableTimer.current) clearTimeout(stableTimer.current);
    };
  }, [queryClient, router]);

  const value = useMemo(() => ({ isConnected }), [isConnected]);

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}
