"use client";

import { useEffect } from "react";
import { toast } from "react-hot-toast";
import { useUser } from "@/hooks/use-user";
import { bridgeOutbox } from "@/services/api/bridge-outbox";

/**
 * App-wide recovery for in-flight bridges. Lives in the authenticated layout so a bridge is
 * tracked and observed from any page, not only the swap screen, and survives tab close/reopen.
 */
const BridgeOutboxWatcher = () => {
  const { data: profile } = useUser();

  useEffect(() => {
    const userId = profile?.id;
    if (!userId) return;
    let stopped = false;

    const run = async () => {
      if (stopped) return;
      try {
        const result = await bridgeOutbox.flush(userId);
        if (result.completed > 0) {
          toast.success("Bridge completed. Funds have arrived on the destination chain.");
        }
        if (result.failed > 0) {
          toast.error("A bridge did not complete. Please check your transaction history.");
        }
      } catch {
        // Keep every persisted job for the next retry.
      }
    };

    void run();
    const timer = setInterval(() => void run(), 15_000);
    window.addEventListener("online", run);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("online", run);
    };
  }, [profile?.id]);

  return null;
};

export default BridgeOutboxWatcher;
