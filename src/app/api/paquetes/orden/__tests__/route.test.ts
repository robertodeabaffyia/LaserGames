/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { PATCH } from "../route";

const mockFrom = jest.fn();
const mockGetUser = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({ from: mockFrom, auth: { getUser: mockGetUser } })
  ),
}));

jest.mock("@/lib/auth-helpers", () => {
  const actual = jest.requireActual("@/lib/auth-helpers");
  return {
    ...actual,
    getUserRol: jest.fn().mockResolvedValue("admin"),
  };
});

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "insert", "update", "delete", "eq", "in", "order", "single", "upsert"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

function patchReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/paquetes/orden", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const validBody = [
  { id: "pkg-1", orden: 0 },
  { id: "pkg-2", orden: 1 },
  { id: "pkg-3", orden: 2 },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("PATCH /api/paquetes/orden", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await PATCH(patchReq(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    const { getUserRol } = jest.requireMock("@/lib/auth-helpers");
    (getUserRol as jest.Mock).mockResolvedValueOnce("supervisor");
    const res = await PATCH(patchReq(validBody));
    expect(res.status).toBe(403);
  });

  it("returns 204 and updates orden for each package", async () => {
    const c = chain({ error: null });
    mockFrom.mockReturnValue(c);

    const res = await PATCH(patchReq(validBody));
    expect(res.status).toBe(204);
    expect(mockFrom).toHaveBeenCalledTimes(validBody.length);
    expect(c.update).toHaveBeenCalledWith({ orden: 0 });
    expect(c.update).toHaveBeenCalledWith({ orden: 1 });
    expect(c.update).toHaveBeenCalledWith({ orden: 2 });
    expect(c.eq).toHaveBeenCalledWith("id", "pkg-1");
    expect(c.eq).toHaveBeenCalledWith("id", "pkg-2");
    expect(c.eq).toHaveBeenCalledWith("id", "pkg-3");
  });

  it("returns 400 when body is not an array", async () => {
    const res = await PATCH(patchReq({ id: "pkg-1", orden: 0 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/array/i);
  });

  it("returns 400 when body is an empty array", async () => {
    const res = await PATCH(patchReq([]));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/array/i);
  });

  it("returns 400 when an entry is missing id", async () => {
    const res = await PATCH(patchReq([{ orden: 0 }]));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/id/i);
  });

  it("returns 400 when an entry is missing orden", async () => {
    const res = await PATCH(patchReq([{ id: "pkg-1" }]));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/orden/i);
  });

  it("returns 400 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ error: { message: "DB constraint violation" } }));
    const res = await PATCH(patchReq([{ id: "pkg-1", orden: 0 }]));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("DB constraint violation");
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest("http://localhost/api/paquetes/orden", {
      method: "PATCH",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PATCH(badReq);
    expect(res.status).toBe(400);
  });
});
