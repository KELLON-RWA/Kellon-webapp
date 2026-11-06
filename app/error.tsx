"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

function isChunkLoadError(error: Error): boolean {
  const message = (error?.message || "").toLowerCase();
  const name = (error?.name || "").toLowerCase();
  return (
    name.includes("chunkloaderror") ||
    message.includes("loading chunk") ||
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("load failed") ||
    message.includes("loading css chunk")
  );
}

export default function AppError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error for diagnostic visibility
    console.error("[Kellon Client Exception]:", error);

    // Auto-recover from stale PWA/browser cache chunk mismatches after deployments
    if (isChunkLoadError(error) && typeof window !== "undefined") {
      const reloadKey = "kellon_chunk_reload_retry";
      const hasRetried = sessionStorage.getItem(reloadKey);
      if (!hasRetried) {
        sessionStorage.setItem(reloadKey, "true");
        window.location.reload();
      }
    }
  }, [error]);

  const handleRetry = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("kellon_chunk_reload_retry");
    }
    reset();
  };

  const handleHardReload = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("kellon_chunk_reload_retry");
      window.location.href = "/";
    }
  };

  return (
    <div className="flex min-h-[90dvh] w-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-[32px] border border-black/5 bg-white/90 p-8 text-center shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-secondary-60/80">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400">
          <AlertCircle className="h-8 w-8" />
        </div>

        <h1 className="text-xl font-bold tracking-tight text-cryptoNight dark:text-white md:text-2xl">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          A temporary client error occurred while loading this view. Tap below to reload or return to your wallet.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Button
            type="button"
            variant="flow"
            size="action"
            onClick={handleRetry}
            className="w-full"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Try Again</span>
          </Button>

          <Button
            type="button"
            variant="flowSecondary"
            size="action"
            onClick={handleHardReload}
            className="w-full"
          >
            <Home className="h-4 w-4" />
            <span>Return to Wallet</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
