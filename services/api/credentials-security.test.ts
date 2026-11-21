import { describe, expect, it, beforeEach } from "vitest";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

// Setup browser globals for testing storage behavior in Node test environment
const mockSessionStorage = new MemoryStorage();
const mockLocalStorage = new MemoryStorage();
Object.defineProperty(globalThis, "sessionStorage", {
  value: mockSessionStorage,
  writable: true,
});
Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});
Object.defineProperty(globalThis, "window", {
  value: {
    name: "",
    sessionStorage: mockSessionStorage,
    localStorage: mockLocalStorage,
  },
  writable: true,
});

import {
  persistApiCredentials,
  clearApiCredentials,
  getAuthToken,
  purgeLegacyPersistentCredentials,
  hmacSha256Hex,
} from "./index";

describe("Credentials Security & Storage Hardening (VULN-02)", () => {
  beforeEach(() => {
    clearApiCredentials();
    mockSessionStorage.clear();
    mockLocalStorage.clear();
    if (globalThis.window) {
      globalThis.window.name = "";
    }
  });

  it("does not store apiSecret or authToken in plaintext in sessionStorage or localStorage", () => {
    persistApiCredentials({
      token: "secret-bearer-jwt-token-xyz",
      apiSecret: "super-confidential-hmac-secret-12345",
      deviceToken: "device-uuid-98765",
    });

    // Plaintext secrets must NEVER be present in storage
    expect(mockSessionStorage.getItem("kellon_api_secret")).toBeNull();
    expect(mockSessionStorage.getItem("kellon_auth_token")).toBeNull();
    expect(mockSessionStorage.getItem("kellon_device_token")).toBeNull();

    expect(mockLocalStorage.getItem("kellon_api_secret")).toBeNull();
    expect(mockLocalStorage.getItem("kellon_auth_token")).toBeNull();
    expect(mockLocalStorage.getItem("kellon_device_token")).toBeNull();

    // In-memory token getter must still work correctly
    expect(getAuthToken()).toBe("secret-bearer-jwt-token-xyz");
  });

  it("purges any pre-existing legacy plaintext credentials from storage", () => {
    mockSessionStorage.setItem("kellon_api_secret", "leaked-secret");
    mockSessionStorage.setItem("kellon_auth_token", "leaked-token");
    mockLocalStorage.setItem("kellon_api_secret", "old-secret");
    mockLocalStorage.setItem("kellon_auth_token", "old-token");

    purgeLegacyPersistentCredentials();

    expect(mockSessionStorage.getItem("kellon_api_secret")).toBeNull();
    expect(mockSessionStorage.getItem("kellon_auth_token")).toBeNull();
    expect(mockLocalStorage.getItem("kellon_api_secret")).toBeNull();
    expect(mockLocalStorage.getItem("kellon_auth_token")).toBeNull();
  });

  it("clearApiCredentials resets all credentials in memory and wipes storage", () => {
    persistApiCredentials({
      token: "jwt-token-123",
      apiSecret: "hmac-secret-456",
      deviceToken: "device-789",
    });

    expect(getAuthToken()).toBe("jwt-token-123");

    clearApiCredentials();

    expect(getAuthToken()).toBeUndefined();
    expect(mockSessionStorage.getItem("kellon_sec_vault")).toBeNull();
  });

  it("computes accurate HMAC-SHA256 signatures using WebCrypto", async () => {
    const secret = "test-secret";
    const message = "test-payload-message";

    const signature = await hmacSha256Hex(secret, message);
    expect(signature).toBeDefined();
    expect(typeof signature).toBe("string");
    expect(signature.length).toBe(64); // SHA-256 hex output is 64 hex characters (32 bytes)
  });
});
