"use client";

import { useEffect } from "react";
import { rewardsService } from "@/services/api/rewards";

const COOKIE = "kellon_ref";

/** Claims a referral code stored by the /join link once the user is signed in. */
export default function ReferralAttributor() {
  useEffect(() => {
    const code = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);
    if (!code) return;
    rewardsService
      .attributeReferral(decodeURIComponent(code))
      .catch(() => undefined)
      .finally(() => {
        document.cookie = `${COOKIE}=; max-age=0; path=/`;
      });
  }, []);

  return null;
}
