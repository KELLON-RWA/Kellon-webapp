"use client";

import { FC, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch"; // Assuming shadcn/ui
import toast from "react-hot-toast";
import {
  disableWebPush,
  enableWebPush,
  isWebPushSupported,
} from "@/lib/realtime/web-push";

interface NotificationSwitchProps {
  initialEnabled?: boolean;
}

const FAILURE_MESSAGES: Record<string, string> = {
  denied:
    "Notifications are blocked for this site. Enable them in your browser settings.",
  unsupported: "This browser does not support push notifications.",
  not_configured: "Push notifications are not available right now.",
  sw_failed: "Could not start the notification service worker.",
};

const NotificationSwitch: FC<NotificationSwitchProps> = ({
  initialEnabled = false,
}) => {
  const [isEnabled, setIsEnabled] = useState(initialEnabled);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  // Reflect the real subscription rather than a local guess — the user may have
  // subscribed on another visit or revoked permission in browser settings.
  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      if (!isWebPushSupported()) {
        if (!cancelled) setIsSupported(false);
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (!cancelled) {
        setIsEnabled(Boolean(subscription) && Notification.permission === "granted");
      }
    };

    sync().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = async (checked: boolean) => {
    setIsLoading(true);
    try {
      if (checked) {
        // Permission must be requested from this click — asking on page load is the
        // fastest route to a permanent block.
        const result = await enableWebPush();
        if (!result.ok) {
          toast.error(
            FAILURE_MESSAGES[result.reason || ""] ||
              "Could not enable notifications",
          );
          setIsEnabled(false);
          return;
        }
        setIsEnabled(true);
        toast.success("Notifications enabled");
      } else {
        await disableWebPush();
        setIsEnabled(false);
        toast.success("Notifications disabled");
      }
    } catch {
      toast.error("Failed to update notification settings");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full flex items-center justify-between p-3 hover:bg-gray-95 dark:hover:bg-secondary-60 rounded-sm transition-colors group">
      <div className="flex items-center gap-3">
        <Bell className="text-primary-70 w-4 h-4" />

        <div className="flex flex-col">
          <p className="text-xs font-bold text-black dark:text-white">
            Push Notifications
          </p>
          <p className="text-[10px] text-gray-20 dark:text-secondary-90">
            {isSupported
              ? "Receive transaction updates"
              : "Not supported in this browser"}
          </p>
        </div>
      </div>

      <Switch
        checked={isEnabled}
        onCheckedChange={handleToggle}
        disabled={isLoading || !isSupported}
        className="data-[state=checked]:bg-pink-500"
      />
    </div>
  );
};

export default NotificationSwitch;
