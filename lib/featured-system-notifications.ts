import type { Notification } from "@/types/db";
import { isSystemNotificationType } from "./notification-category";

/** Feature the latest backend announcement/marketing notices, not transaction copy. */
export function getFeaturedSystemNotifications(
  notifications: Notification[],
  limit = 3,
): Notification[] {
  return notifications
    .filter((notification) => isSystemNotificationType(notification.type))
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    )
    .slice(0, Math.max(0, Math.min(3, limit)));
}
