/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

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

function req(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/items", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  });
}

const mockItem = {
  id: "item-1",
  nombre: "Hora de laser tag",
  descripcion: null,
  categoria: "actividad",
  unidad: "hora",
  es_activo: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => jest.clearAllMocks());

// ── GET /api/items ────────────────────────────────────────────────────────────

describe("GET /api/items", () => {
  it("returns 200 with item list", async () => {
    mockFrom.mockReturnValue(chain({ data: [mockItem], error: null }));

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([mockItem]);
    expect(mockFrom).toHaveBeenCalledWith("items");
  });

  it("returns 500 on database error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Connection refused" } }));

    const res = await GET();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Connection refused");
  });
});

// ── POST /api/items ───────────────────────────────────────────────────────────

describe("POST /api/items", () => {
  it("returns 201 with created item", async () => {
    mockFrom.mockReturnValue(chain({ data: mockItem, error: null }));

    const res = await POST(req("POST", { nombre: "Hora de laser tag", categoria: "actividad", unidad: "hora", es_activo: true }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(mockItem);
  });

  it("returns 400 when nombre is missing", async () => {
    const res = await POST(req("POST", { categoria: "actividad" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/nombre/);
  });

  it("returns 400 on database insert error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Not null violation" } }));

    const res = await POST(req("POST", { nombre: "Item" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest("http://localhost/api/items", {
      method: "POST",
      body: "{bad}",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });
});
