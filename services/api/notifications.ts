import { Notification } from "@/types/db";
import { ApiResponse, apiFetch, handleResponse } from ".";

export interface NotificationHistoryParams {
  limit?: number;
  offset?: number;
}

const NOTIFICATION_API_PREFIXES = ["/api/notifications", "/api/notification"];

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asDateValue(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return new Date();
}

function normalizeNotification(value: unknown): Notification {
  const notification = isRecord(value) ? value : {};
  const createdAt = asDateValue(notification.createdAt);
  const updatedAt = asDateValue(notification.updatedAt || createdAt);
  const isRead =
    notification.read === true ||
    notification.isRead === true ||
    Boolean(notification.readAt) ||
    asString(notification.status).toUpperCase() === "READ";

  return {
    id: asString(notification.id || notification._id),
    userId: asString(notification.userId),
    type: asString(notification.type, "GENERAL"),
    channel: asString(notification.channel, "IN_APP"),
    status: asString(notification.status, isRead ? "READ" : "UNREAD"),
    recipient: asString(notification.recipient),
    subject: asString(notification.subject || notification.title) || null,
    content:
      asString(
        notification.content || notification.message || notification.body,
      ) || null,
    metadata: isRecord(notification.metadata) ? notification.metadata : null,
    sentAt: notification.sentAt ? asDateValue(notification.sentAt) : null,
    readAt: notification.readAt
      ? asDateValue(notification.readAt)
      : isRead
        ? updatedAt
        : null,
    createdAt,
    updatedAt,
  };
}

function extractNotificationList(
  value: unknown,
  visited = new WeakSet<object>(),
): Notification[] {
  if (Array.isArray(value)) {
    return value.map(normalizeNotification).filter((item) => item.id);
  }

  if (!isRecord(value)) return [];
  if (visited.has(value)) return [];
  visited.add(value);

  if (value.id || value._id) {
    const notification = normalizeNotification(value);
    return notification.id ? [notification] : [];
  }

  const candidates = [
    value.history,
    value.notifications,
    value.notificationHistory,
    value.items,
    value.results,
    value.rows,
    value.records,
    value.docs,
    value.data,
  ];

  for (const candidate of candidates) {
    const notifications = extractNotificationList(candidate, visited);
    if (notifications.length > 0) return notifications;
  }

  return [];
}

function extractUnreadCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (!isRecord(value)) return 0;

  const count =
    value.count ?? value.unreadCount ?? value.unread ?? value.totalUnread;

  if (typeof count === "number" && Number.isFinite(count)) return count;
  if (typeof count === "string") {
    const parsed = Number(count);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

async function fetchNotificationEndpoint(
  pathFactory: (prefix: string) => string,
  init: RequestInit,
): Promise<Response> {
  let response: Response | null = null;

  for (const prefix of NOTIFICATION_API_PREFIXES) {
    response = await apiFetch(pathFactory(prefix), init, { signed: false });

    if (response.status !== 404) {
      return response;
    }
  }

  return response as Response;
}

/**
 * Notification Service
 * Handles fetching and managing user notifications.
 * Note: These endpoints use session-based auth via the app API rewrite.
 */
export const notificationService = {
  /**
   * GET /api/notifications
   * Retrieves notification history for the current user.
   */
  getNotifications: async (
    params?: NotificationHistoryParams,
  ): Promise<ApiResponse<Notification[]>> => {
    const query = new URLSearchParams();

    if (params?.limit !== undefined) query.set("limit", String(params.limit));
    if (params?.offset !== undefined)
      query.set("offset", String(params.offset));

    const res = await fetchNotificationEndpoint(
      (prefix) => (query.toString() ? `${prefix}?${query.toString()}` : prefix),
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
    );

    const response = await handleResponse<unknown>(res);

    return {
      success: true,
      data: extractNotificationList(response.data),
    };
  },

  /**
   * GET /api/notifications/unread-count
   * Retrieves the count of unread notifications for the current user.
   */
  getUnreadCount: async (): Promise<ApiResponse<{ count: number }>> => {
    const res = await fetchNotificationEndpoint(
      (prefix) => `${prefix}/unread-count`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
    );

    const response = await handleResponse<unknown>(res);

    return {
      success: true,
      data: { count: extractUnreadCount(response.data) },
    };
  },

  /**
   * GET /api/notifications/:id
   * Retrieves a single notification by ID.
   */
  getNotification: async (id: string): Promise<ApiResponse<Notification>> => {
    const res = await fetchNotificationEndpoint((prefix) => `${prefix}/${id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const response = await handleResponse<unknown>(res);

    return {
      success: true,
      data: normalizeNotification(response.data),
    };
  },

  /**
   * PATCH /api/notifications/:id/read
   * Marks a single notification as read.
   */
  markAsRead: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const res = await fetchNotificationEndpoint(
      (prefix) => `${prefix}/${id}/read`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      },
    );

    return handleResponse(res);
  },

  /**
   * POST /api/notifications/mark-all-read
   * Marks all notifications as read for the current user.
   */
  markAllAsRead: async (): Promise<ApiResponse<{ message: string }>> => {
    const res = await fetchNotificationEndpoint(
      (prefix) => `${prefix}/mark-all-read`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );

    return handleResponse(res);
  },
};
