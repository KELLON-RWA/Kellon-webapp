"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { FC } from "react";
import { useUnreadCount } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { ActionToolTip } from "@/components/ActionTooltip";

const NotificationBell: FC = () => {
  const { data: unreadCount = 0 } = useUnreadCount();
  const hasUnread = unreadCount > 0;

  const label = hasUnread
    ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
    : "Notifications";

  return (
    <ActionToolTip label={label} side="bottom">
    <Link
      href="/notifications"
      aria-label={label}
      className={cn(
        "relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl",
        "transition-colors hover:bg-gray-90 dark:hover:bg-secondary-60/50",
        hasUnread &&
          "text-primary-50 dark:text-primary-80 bg-primary-95/70 dark:bg-primary-70/10",
      )}
    >
      <Bell
        className={cn(
          "h-5 w-5",
          hasUnread
            ? "text-primary-50 dark:text-primary-80"
            : "text-secondary-60 dark:text-gray-50",
        )}
      />

      {hasUnread && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1.5 right-1.5 flex items-center justify-center",
            "min-w-[16px] h-4 rounded-full px-1",
            "bg-primary-50 text-white text-[9px] font-bold leading-none shadow-sm shadow-primary-50/20",
          )}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
    </ActionToolTip>
  );
};

export default NotificationBell;
