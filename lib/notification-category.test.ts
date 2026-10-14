import { describe, expect, it } from "vitest";
import { isSystemNotificationType } from "./notification-category";

describe("system notification types", () => {
  it.each(["ANNOUNCEMENT", "MARKETING", "announcement", " marketing "])(
    "puts %s under System",
    (type) => {
      expect(isSystemNotificationType(type)).toBe(true);
    },
  );
  it.each(["TRANSFER_IN", "DEPOSIT", "GENERAL", ""])(
    "does not override %s classification",
    (type) => {
      expect(isSystemNotificationType(type)).toBe(false);
    },
  );
});
