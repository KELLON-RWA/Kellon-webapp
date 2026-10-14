import { describe, expect, it } from "vitest";
import type { Notification } from "@/types/db";
import { getFeaturedSystemNotifications } from "./featured-system-notifications";

const notice = (
  id: string,
  type: string,
  day: number,
  read = false,
): Notification => ({
  id,
  type,
  userId: "user",
  channel: "IN_APP",
  status: read ? "READ" : "UNREAD",
  recipient: "user",
  subject: "Update",
  content: "Buy USDC",
  metadata: null,
  sentAt: null,
  readAt: read ? new Date("2026-10-14") : null,
  createdAt: new Date(Date.UTC(2026, 9, day)),
  updatedAt: new Date(Date.UTC(2026, 9, day)),
});

describe("featured wallet updates", () => {
  it("shows announcement and marketing types, excluding transactions", () => {
    const items = [
      notice("transaction", "DEPOSIT", 14),
      notice("announcement", "ANNOUNCEMENT", 12),
      notice("marketing", "marketing", 13),
    ];
    expect(
      getFeaturedSystemNotifications(items).map((item) => item.id),
    ).toEqual(["marketing", "announcement"]);
  });
  it("shows at most three latest updates without mutating the input", () => {
    const items = [1, 2, 3, 4].map((day) =>
      notice(String(day), "ANNOUNCEMENT", day),
    );
    expect(
      getFeaturedSystemNotifications(items).map((item) => item.id),
    ).toEqual(["4", "3", "2"]);
    expect(items.map((item) => item.id)).toEqual(["1", "2", "3", "4"]);
    expect(getFeaturedSystemNotifications(items, 10)).toHaveLength(3);
  });
  it("keeps read updates visible and handles an empty list", () => {
    expect(
      getFeaturedSystemNotifications([notice("read", "MARKETING", 14, true)]),
    ).toHaveLength(1);
    expect(getFeaturedSystemNotifications([])).toEqual([]);
  });
});
