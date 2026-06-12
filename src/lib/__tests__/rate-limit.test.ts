/**
 * @jest-environment node
 */
import { NextRequest, NextResponse } from "next/server";
import { getClientIp, checkRateLimit, _resetLimiters } from "../rate-limit";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeRequest(
  headers: Record<string, string> = {},
  url = "http://localhost/api/test"
): NextRequest {
  return new NextRequest(url, { headers });
}

// ── getClientIp ───────────────────────────────────────────────────────────────

describe("getClientIp", () => {
  it("returns first IP from x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const req = makeRequest({ "x-real-ip": "9.10.11.12" });
    expect(getClientIp(req)).toBe("9.10.11.12");
  });

  it("falls back to 127.0.0.1 when no IP header", () => {
    const req = makeRequest();
    expect(getClientIp(req)).toBe("127.0.0.1");
  });

  it("trims whitespace from x-forwarded-for", () => {
    const req = makeRequest({ "x-forwarded-for": "  203.0.113.1  , 10.0.0.1" });
    expect(getClientIp(req)).toBe("203.0.113.1");
  });
});

// ── checkRateLimit — no env vars (local dev) ─────────────────────────────────

describe("checkRateLimit — no Upstash config", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    _resetLimiters();
  });

  it("allows requests when env vars are missing (strict)", async () => {
    const result = await checkRateLimit("strict", makeRequest());
    expect(result).toBeNull();
  });

  it("allows requests when env vars are missing (general)", async () => {
    const result = await checkRateLimit("general", makeRequest());
    expect(result).toBeNull();
  });
});

// ── checkRateLimit — with Upstash (mocked) ───────────────────────────────────

const mockLimit = jest.fn();

jest.mock("@upstash/redis", () => ({
  Redis: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(
    jest.fn().mockImplementation(() => ({ limit: mockLimit })),
    {
      slidingWindow: jest.fn().mockReturnValue("sliding-window-config"),
    }
  ),
}));

describe("checkRateLimit — with Upstash config", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
    _resetLimiters();
    mockLimit.mockReset();
  });

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    _resetLimiters();
  });

  it("returns null when under the limit", async () => {
    mockLimit.mockResolvedValue({ success: true });
    const result = await checkRateLimit("strict", makeRequest());
    expect(result).toBeNull();
  });

  it("returns 429 response when limit exceeded", async () => {
    mockLimit.mockResolvedValue({ success: false });
    const result = await checkRateLimit("strict", makeRequest());
    expect(result).toBeInstanceOf(NextResponse);
    expect(result!.status).toBe(429);
    const body = await result!.json();
    expect(body.error).toMatch(/Demasiados intentos/);
  });

  it("returns 429 for general limiter when exceeded", async () => {
    mockLimit.mockResolvedValue({ success: false });
    const result = await checkRateLimit("general", makeRequest());
    expect(result!.status).toBe(429);
  });

  it("uses the client IP as the rate limit key", async () => {
    mockLimit.mockResolvedValue({ success: true });
    const req = makeRequest({ "x-forwarded-for": "1.2.3.4" });
    await checkRateLimit("general", req);
    expect(mockLimit).toHaveBeenCalledWith("1.2.3.4");
  });
});
