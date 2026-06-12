/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, PUT, DELETE } from "../route";

const mockFrom = jest.fn();
const mockGetUser = jest.fn();
mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({ from: mockFrom, auth: { getUser: mockGetUser } })
  ),
}));

// Mock auth-helpers so role checks pass without touching the DB
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

const ID = "item-1";
const params = { params: Promise.resolve({ id: ID }) };

function req(method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/items/${ID}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  });
}

const mockItem = {
  id: ID,
  nombre: "Hora de laser tag",
  descripcion: null,
  categoria: "actividad",
  unidad: "hora",
  es_activo: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => jest.clearAllMocks());

// ── GET /api/items/[id] ───────────────────────────────────────────────────────

describe("GET /api/items/[id]", () => {
  it("returns 200 with the item", async () => {
    mockFrom.mockReturnValue(chain({ data: mockItem, error: null }));

    const res = await GET(req("GET"), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockItem);
  });

  it("returns 404 when Supabase returns PGRST116", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Row not found", code: "PGRST116" } }));

    const res = await GET(req("GET"), params);
    expect(res.status).toBe(404);
  });

  it("returns 500 on other database error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Server error", code: "50000" } }));

    const res = await GET(req("GET"), params);
    expect(res.status).toBe(500);
  });
});

// ── PUT /api/items/[id] ───────────────────────────────────────────────────────

describe("PUT /api/items/[id]", () => {
  it("returns 200 with the updated item", async () => {
    const updated = { ...mockItem, nombre: "Sesión de laser tag" };
    mockFrom.mockReturnValue(chain({ data: updated, error: null }));

    const res = await PUT(req("PUT", { nombre: "Sesión de laser tag" }), params);
    expect(res.status).toBe(200);
    expect((await res.json()).nombre).toBe("Sesión de laser tag");
  });

  it("returns 404 when item not found", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Not found", code: "PGRST116" } }));

    const res = await PUT(req("PUT", { nombre: "X" }), params);
    expect(res.status).toBe(404);
  });

  it("returns 400 on database error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Constraint", code: "23000" } }));

    const res = await PUT(req("PUT", { nombre: "X" }), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest(`http://localhost/api/items/${ID}`, {
      method: "PUT",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(badReq, params);
    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/items/[id] ────────────────────────────────────────────────────

describe("DELETE /api/items/[id]", () => {
  it("returns 204 on success", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(204);
    expect(mockFrom).toHaveBeenCalledWith("items");
  });

  it("returns 400 on database error (e.g. FK constraint)", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Foreign key violation" } }));

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Foreign key violation");
  });
});
