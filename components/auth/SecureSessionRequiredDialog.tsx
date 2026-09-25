"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Loader2, ShieldAlert } from "lucide-react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  isSecureSessionLoginRequired,
  SECURE_SESSION_MISSING_EVENT,
} from "@/lib/secure-session";
import { signOutAndReturnToLogin } from "./Signout";

/**
 * A secure session is required for signed requests. This dialog deliberately
 * has no dismiss control: continuing to use the page would only repeat a
 * request that the browser cannot securely sign.
 */
export default function SecureSessionRequiredDialog() {
  const { logout } = usePrivy();
  const [open, setOpen] = useState(isSecureSessionLoginRequired);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(SECURE_SESSION_MISSING_EVENT, show);
    if (isSecureSessionLoginRequired()) show();

    return () => window.removeEventListener(SECURE_SESSION_MISSING_EVENT, show);
  }, []);

  const returnToLogin = async () => {
    setIsLeaving(true);
    await signOutAndReturnToLogin(logout);
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        aria-describedby="secure-session-description"
        className="w-[calc(100%-2rem)] max-w-sm rounded-[32px] border-none bg-gray-70 p-6 outline-none dark:bg-black2"
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <AlertDialogHeader className="!place-items-center !text-center sm:!place-items-center sm:!text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary-70/15 text-primary-60">
            <ShieldAlert className="size-6" aria-hidden="true" />
          </div>
          <AlertDialogTitle className="w-full text-center text-xl font-bold text-cryptoNight dark:text-white">
            Session expired
          </AlertDialogTitle>
          <AlertDialogDescription
            id="secure-session-description"
            className="mx-auto max-w-xs text-center text-sm leading-6 text-gray-10 dark:text-gray-40"
          >
            Your session has expired. Log in again to continue.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-4 !grid grid-cols-1 gap-3 sm:!grid sm:grid-cols-1">
          <Button
            type="button"
            variant="flow"
            size="flow"
            className="w-full bg-primary-40 bg-none text-white hover:bg-primary-30 dark:bg-gradient-to-r dark:from-primary-70 dark:to-primary-60 dark:hover:bg-none"
            disabled={isLeaving}
            onClick={returnToLogin}
          >
            {isLeaving ? (
              <Loader2
                className="relative z-10 size-4 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            <span className="relative z-10">
              {isLeaving ? "Returning to login..." : "Log in again"}
            </span>
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
