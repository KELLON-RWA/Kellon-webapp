"use client";

import { FC, useState } from "react";
import Cookies from "js-cookie";

import { LogOut, Loader2 } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { cn } from "@/lib/utils";

// 1. Import your custom API logout function
import { logout as apiLogout } from "@/services/api/auth";
import { disableWebPush } from "@/lib/realtime/web-push";

const Signout: FC = () => {
  const [isLoading, setIsLoading] = useState(false);

  // 2. Alias the Privy logout function to avoid naming conflicts
  const { logout: privyLogout } = usePrivy();

  const handleSignout = async () => {
    setIsLoading(true);
    const deviceToken = Cookies.get("deviceToken");

    try {
      await disableWebPush().catch(() => {});
      // Backend logout
      await apiLogout(deviceToken || "");
    } catch (error) {
      console.error("Backend logout failed:", error);
    } finally {
      // Remove cookie
      Cookies.remove("deviceToken", { path: "/" });

      try {
        // Privy logout
        await privyLogout();
      } catch (error) {
        console.error("Privy logout failed:", error);
      }

      // Redirect
      window.location.href = "/continue";
      setIsLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "text-red-400 focus:bg-red-400/10 focus:text-red-400 cursor-pointer py-3 rounded-xl transition-colors flex items-center",
        isLoading && "opacity-50 pointer-events-none",
      )}
      onClick={handleSignout}
    >
      {isLoading ? (
        <Loader2 className="mr-3 h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="mr-3 h-4 w-4" />
      )}
      <span>{isLoading ? "Signing out..." : "Sign out"}</span>
    </div>
  );
};

export default Signout;
