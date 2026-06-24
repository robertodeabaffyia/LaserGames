/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, PUT } from "../route";

const mockFrom = jest.fn();
const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({ from: mockFrom, auth: { getUser: mockGetUser } })
  ),
}));

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "upsert", "eq", "is", "order", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const mockRows = [
  { id: "p1", sala_id: null, cantidad: 2, precio_por_persona: 5000, created_at: "x", updated_at: "x" },
  { id: "p2", sala_id: null, cantidad: 3, precio_por_persona: 4500, created_at: "x", updated_at: "x" },
];

function req(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/escape/precios", {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/escape/precios", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns the global price tiers ordered by cantidad", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const c = chain({ data: mockRows, error: null });
    mockFrom.mockReturnValue(c);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(c.is).toHaveBeenCalledWith("sala_id", null);
  });

  it("returns 500 on DB error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "DB error" } }));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("PUT /api/escape/precios", () => {
  const validBody = { precios: { 2: 5000, 3: 4500, 10: 3000 } };

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await PUT(req("PUT", validBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "general" }, error: null }));

    const res = await PUT(req("PUT", validBody));
    expect(res.status).toBe(403);
  });

  it("upserts the price tiers for admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    const upsertChain = chain({ data: mockRows, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }))
      .mockReturnValueOnce(upsertChain);

    const res = await PUT(req("PUT", validBody));
    expect(res.status).toBe(200);
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        { sala_id: null, cantidad: 2, precio_por_persona: 5000 },
        { sala_id: null, cantidad: 3, precio_por_persona: 4500 },
        { sala_id: null, cantidad: 10, precio_por_persona: 3000 },
      ]),
      { onConflict: "cantidad" }
    );
  });

  it("returns 400 when cantidad is out of range", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }));

    const res = await PUT(req("PUT", { precios: { 1: 5000 } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/cantidad/);
  });

  it("returns 400 when cantidad exceeds max", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }));

    const res = await PUT(req("PUT", { precios: { 11: 5000 } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when precio_por_persona is negative", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }));

    const res = await PUT(req("PUT", { precios: { 2: -100 } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when precios is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }));

    const res = await PUT(req("PUT", {}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when precios is empty", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }));

    const res = await PUT(req("PUT", { precios: {} }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }));

    const badReq = new NextRequest("http://localhost/api/escape/precios", {
      method: "PUT",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(badReq);
    expect(res.status).toBe(400);
  });

  it("returns 400 on DB error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: "DB error" } }));

    const res = await PUT(req("PUT", validBody));
    expect(res.status).toBe(400);
  });
});
