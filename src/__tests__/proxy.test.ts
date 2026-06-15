/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { proxy, SESSION_INACTIVITY_MS } from "../proxy";

// ── mocks ─────────────────────────────────────────────────────────────────────

const mockGetUser = jest.fn();
const mockSignOut = jest.fn();

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut,
    },
  })),
}));

jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn().mockResolvedValue(null),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function makeRequest(
  path: string,
  cookies: Record<string, string> = {},
  method = "GET"
): NextRequest {
  const req = new NextRequest(new URL(`http://localhost${path}`), { method });
  Object.entries(cookies).forEach(([name, value]) => req.cookies.set(name, value));
  return req;
}

// ── SESSION_INACTIVITY_MS constant ────────────────────────────────────────────

describe("SESSION_INACTIVITY_MS", () => {
  it("is exactly 30 minutes in milliseconds", () => {
    expect(SESSION_INACTIVITY_MS).toBe(30 * 60 * 1000);
  });
});

// ── inactivity timeout ────────────────────────────────────────────────────────

describe("proxy — session inactivity timeout", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockSignOut.mockReset();
    mockSignOut.mockResolvedValue({ error: null });
  });

  it("sets last_activity cookie on first authenticated request (no prior cookie)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    // Use /admin/configuracion to avoid config-guard redirect (no x-config-ok)
    const req = makeRequest("/admin/configuracion");
    const res = await proxy(req);

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(res.status).not.toBe(307);

    const cookie = res.cookies.get("last_activity");
    expect(cookie).toBeDefined();
    expect(Number(cookie?.value)).toBeGreaterThan(0);
  });

  it("allows through and refreshes last_activity when well within the window", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const fiveMinAgo = String(Date.now() - 5 * 60 * 1000);
    const req = makeRequest("/admin/configuracion", { last_activity: fiveMinAgo });
    const res = await proxy(req);

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(res.status).not.toBe(307);

    const updated = Number(res.cookies.get("last_activity")?.value);
    expect(updated).toBeGreaterThan(Number(fiveMinAgo));
  });

  it("does NOT expire when last_activity is just under SESSION_INACTIVITY_MS", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    // 100 ms inside the window — should never flake
    const justUnder = String(Date.now() - (SESSION_INACTIVITY_MS - 100));
    const req = makeRequest("/admin/configuracion", { last_activity: justUnder });
    const res = await proxy(req);

    expect(mockSignOut).not.toHaveBeenCalled();
    expect(res.status).not.toBe(307);
  });

  it("signs out and redirects to /login when last_activity is past SESSION_INACTIVITY_MS", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const expired = String(Date.now() - SESSION_INACTIVITY_MS - 1000);
    const req = makeRequest("/dashboard", { last_activity: expired });
    const res = await proxy(req);

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(307);

    const location = res.headers.get("location")!;
    expect(location).toContain("/login");
    expect(location).toContain("message=");
    expect(decodeURIComponent(location)).toContain("inactividad");
  });

  it("redirect message uses the Spanish inactivity string", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const expired = String(Date.now() - SESSION_INACTIVITY_MS - 1000);
    const req = makeRequest("/dashboard", { last_activity: expired });
    const res = await proxy(req);

    const location = res.headers.get("location")!;
    const message = new URL(location).searchParams.get("message");
    expect(message).toBe("Tu sesión expiró por inactividad");
  });

  it("does not check inactivity for unauthenticated requests", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const expired = String(Date.now() - SESSION_INACTIVITY_MS - 1000);
    const req = makeRequest("/dashboard", { last_activity: expired });
    await proxy(req);

    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
