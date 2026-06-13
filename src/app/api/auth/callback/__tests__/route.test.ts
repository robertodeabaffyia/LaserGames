/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";

const mockExchangeCodeForSession = jest.fn();
const mockVerifyOtp = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
        verifyOtp: mockVerifyOtp,
      },
    })
  ),
}));

function callbackRequest(params: Record<string, string>): NextRequest {
  const url = new URL("http://localhost/api/auth/callback");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

beforeEach(() => {
  mockExchangeCodeForSession.mockReset();
  mockVerifyOtp.mockReset();
});

describe("GET /api/auth/callback — PKCE (?code=)", () => {
  it("recovery: redirects to /update-password on success", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(callbackRequest({ code: "abc", type: "recovery" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/update-password");
  });

  it("normal login: redirects to /dashboard on success", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    const res = await GET(callbackRequest({ code: "abc" }));
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("failed exchange: redirects to /login with error", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: { message: "bad" } });
    const res = await GET(callbackRequest({ code: "abc", type: "recovery" }));
    const location = res.headers.get("location")!;
    expect(location).toContain("/login?error=");
  });
});

describe("GET /api/auth/callback — OTP (?token_hash=&type=)", () => {
  it("recovery: verifies OTP and redirects to /update-password", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    const res = await GET(
      callbackRequest({ token_hash: "hash123", type: "recovery" })
    );
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      type: "recovery",
      token_hash: "hash123",
    });
    expect(res.headers.get("location")).toBe("http://localhost/update-password");
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("expired token: redirects to /login with error", async () => {
    mockVerifyOtp.mockResolvedValue({ error: { message: "expired" } });
    const res = await GET(
      callbackRequest({ token_hash: "hash123", type: "recovery" })
    );
    expect(res.headers.get("location")).toContain("/login?error=");
  });

  it("non-recovery type honors the next param", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });
    const res = await GET(
      callbackRequest({ token_hash: "hash123", type: "email", next: "/admin" })
    );
    expect(res.headers.get("location")).toBe("http://localhost/admin");
  });
});

describe("GET /api/auth/callback — no params", () => {
  it("redirects to /login with error", async () => {
    const res = await GET(callbackRequest({}));
    expect(res.headers.get("location")).toContain("/login?error=");
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });
});
