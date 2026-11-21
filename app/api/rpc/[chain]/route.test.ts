import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

describe("RPC proxy route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns 503 if ALCHEMY_RPC_KEY is not set", async () => {
    delete process.env.ALCHEMY_RPC_KEY;
    delete process.env.ALCHEMY_API_KEY;

    const request = new Request("http://localhost:3000/api/rpc/base", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_blockNumber",
        params: [],
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ chain: "base" }),
    });

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.message).toContain("RPC proxy not configured");
  });

  it("returns 503 if chain is unsupported", async () => {
    process.env.ALCHEMY_RPC_KEY = "test-alchemy-key";

    const request = new Request("http://localhost:3000/api/rpc/unknownchain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_blockNumber",
        params: [],
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ chain: "unknownchain" }),
    });

    expect(response.status).toBe(503);
  });

  it("returns 400 if method is not allowed", async () => {
    process.env.ALCHEMY_RPC_KEY = "test-alchemy-key";

    const request = new Request("http://localhost:3000/api/rpc/base", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "hardhat_reset",
        params: [],
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ chain: "base" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.message).toContain("Method hardhat_reset is not allowed");
  });

  it("returns 403 if request is from an unauthorized cross-site origin", async () => {
    process.env.ALCHEMY_RPC_KEY = "test-alchemy-key";

    const request = new Request("http://localhost:3000/api/rpc/base", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "https://evil-attacker.com",
        "sec-fetch-site": "cross-site",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_blockNumber",
        params: [],
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ chain: "base" }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.message).toContain("Cross-site RPC requests are forbidden");
  });

  it("returns 401 if request has no valid credentials", async () => {
    process.env.ALCHEMY_RPC_KEY = "test-alchemy-key";

    const request = new Request("http://localhost:3000/api/rpc/base", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-unauthorized": "true",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_blockNumber",
        params: [],
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ chain: "base" }),
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.message).toContain("Unauthorized RPC proxy access");
  });

  it("returns 400 if batch size exceeds maximum allowed limit", async () => {
    process.env.ALCHEMY_RPC_KEY = "test-alchemy-key";

    const batch = Array.from({ length: 15 }, (_, i) => ({
      jsonrpc: "2.0",
      id: i + 1,
      method: "eth_blockNumber",
      params: [],
    }));

    const request = new Request("http://localhost:3000/api/rpc/base", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });

    const response = await POST(request, {
      params: Promise.resolve({ chain: "base" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.message).toContain("Batch size exceeds limit");
  });

  it("returns 400 if eth_getLogs has no filter criteria", async () => {
    process.env.ALCHEMY_RPC_KEY = "test-alchemy-key";

    const request = new Request("http://localhost:3000/api/rpc/base", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getLogs",
        params: [{}],
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ chain: "base" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.message).toContain("requires an address or topics filter");
  });

  it("forwards allowed method to Alchemy", async () => {
    process.env.ALCHEMY_RPC_KEY = "test-alchemy-key";

    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        result: "0x123456",
      }),
    });
    global.fetch = mockFetch;

    const request = new Request("http://localhost:3000/api/rpc/base", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer valid-auth-token-12345",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_blockNumber",
        params: [],
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ chain: "base" }),
    });

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://base-mainnet.g.alchemy.com/v2/test-alchemy-key",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const body = await response.json();
    expect(body.result).toBe("0x123456");
  });
});
