"use client";

import { FC, useEffect, useRef, useState } from "react";
import {
  usePrivy,
  useLoginWithOAuth,
  useIdentityToken,
} from "@privy-io/react-auth";
import { Loader2 } from "lucide-react";

import { loginWithPrivy } from "@/services/api/auth";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icons } from "@/components/Icons";
import AuthHero from "./AuthHero";

interface ContinueProps {
  onSuccessRedirect?: string;
}

const Continue: FC<ContinueProps> = ({ onSuccessRedirect = "/" }) => {
  const [isSyncing, setIsSyncing] = useState(false);

  const hasSynced = useRef(false);

  const { authenticated, ready } = usePrivy();

  const { initOAuth, loading: oauthLoading } = useLoginWithOAuth();

  const { identityToken } = useIdentityToken();

  useEffect(() => {
    const syncUser = async () => {
      if (!identityToken || hasSynced.current) return;

      hasSynced.current = true;
      setIsSyncing(true);

      try {
        await loginWithPrivy(identityToken);

        await new Promise((resolve) => setTimeout(resolve, 100));

        window.location.href = onSuccessRedirect;
      } catch (err) {
        console.error("Auth sync failed:", err);

        setIsSyncing(false);
        hasSynced.current = false;
      }
    };

    if (ready && authenticated && identityToken) {
      syncUser();
    }
  }, [ready, authenticated, identityToken, onSuccessRedirect]);

  const handleOAuthLogin = async (provider: "google" | "apple") => {
    try {
      await initOAuth({ provider });
    } catch (err) {
      console.error(`${provider} login failed:`, err);
    }
  };

  const isBusy = !ready || oauthLoading || isSyncing;

  return (
    <div className="flex min-h-screen w-full overflow-hidden ">
      {/* LEFT SIDE */}
      <AuthHero />

      {/* RIGHT SIDE */}
      <div
        className={cn(
          "relative flex flex-1 items-center justify-center overflow-hidden p-6 lg:p-12",
        )}
      >
        {/* Card */}
        <div className="relative z-10 w-full max-w-[500px]">
          <Card className="overflow-hidden rounded-[40px] border-0 shadow-none lg:border bg:border-white/60 dark:border-secondary-60 bg-transparent lg:bg-white/90 lg:dark:bg-secondary-60 lg:shadow-[0_20px_80px_rgba(0,0,0,0.06)] backdrop-blur-xl lg:max-w-md lg:mx-auto">
            <CardContent className="p-6 sm:p-8 md:p-12">
              {/* Mobile Logo */}
              <div className="mb-10 flex justify-center">
                <div className="flex items-center gap-3">
                  <Icons.Logo aria-hidden="true" className="h-11 w-11" />

                  <span className="text-2xl font-bold  text-cryptoNight dark:text-white ">
                    Kellon
                  </span>
                </div>
              </div>

              {/* Heading */}

              <div className="mb-10 space-y-4 text-center">
                <h1 className="font-bold text-4xl text-cryptoNight dark:text-white max-w-[340px] mx-auto md:max-w-none md:text-5xl">
                  Get started in seconds
                </h1>

                <p className="mx-auto max-w-[340px] text-[15px] leading-relaxed text-gray-400 dark:text-gray-100">
                  you&apos;re one step away
                </p>
              </div>

              {/* CTA */}
              <div className="space-y-5">
                <Button
                  type="button"
                  onClick={() => handleOAuthLogin("google")}
                  disabled={isBusy}
                  size="full"
                  variant={"secondary"}
                  className="h-[60px] rounded-2xl border hover:bg-secondary-70 dark:bg-white2 text-white dark:hover:bg-gray-200 dark:text-2xl dark:text-gray-700 "
                >
                  {oauthLoading || isSyncing ? (
                    <Loader2
                      aria-hidden="true"
                      className="h-5 w-5 animate-spin text-white dark:text-gray-700"
                    />
                  ) : (
                    <Icons.Google aria-hidden="true" className="h-5 w-5" />
                  )}

                  <span className="ml-3 text-[15px] font-semibold ">
                    Continue with Google
                  </span>
                </Button>

                <p className="text-center text-xs leading-relaxed text-gray-400 dark:text-gray-100">
                  Fast onboarding. No complicated setup.
                </p>
              </div>

              {/* Footer */}
              <div className="mt-10 border-t border-neutral-100 dark:border-gray-500 pt-6">
                <p className="text-center text-xs leading-relaxed text-gray-400 dark:text-gray-100">
                  By continuing, you agree to Kellon&apos;s Terms and Privacy
                  Policy.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Continue;
