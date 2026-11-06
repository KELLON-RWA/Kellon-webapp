"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[Kellon Global Exception]:", error);

    const message = (error?.message || "").toLowerCase();
    const name = (error?.name || "").toLowerCase();
    const isChunkError =
      name.includes("chunkloaderror") ||
      message.includes("loading chunk") ||
      message.includes("failed to fetch dynamically imported module") ||
      message.includes("load failed");

    if (isChunkError && typeof window !== "undefined") {
      const reloadKey = "kellon_global_chunk_reload";
      const hasRetried = sessionStorage.getItem(reloadKey);
      if (!hasRetried) {
        sessionStorage.setItem(reloadKey, "true");
        window.location.reload();
      }
    }
  }, [error]);

  const handleRetry = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("kellon_global_chunk_reload");
    }
    reset();
  };

  const handleHome = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("kellon_global_chunk_reload");
      window.location.href = "/";
    }
  };

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white font-sans antialiased">
        <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-slate-900/90 p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-400">
            <AlertCircle className="h-8 w-8" />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white md:text-2xl">
            Application Error
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            A client-side exception occurred while loading the app. Tap below to reload or return to your wallet.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 text-sm font-bold text-white shadow-lg transition hover:opacity-90 active:scale-[0.98]"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Try Again</span>
            </button>

            <button
              type="button"
              onClick={handleHome}
              className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-800 px-5 text-sm font-bold text-white transition hover:bg-slate-700 active:scale-[0.98]"
            >
              <Home className="h-4 w-4" />
              <span>Return to Wallet</span>
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
