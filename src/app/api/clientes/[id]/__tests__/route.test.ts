/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, PUT, DELETE } from "../route";

const mockFrom = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "insert", "update", "delete", "eq", "or", "in", "order", "single", "limit"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const ID = "cli-1";
const params = { params: Promise.resolve({ id: ID }) };

function req(method: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/clientes/${ID}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  });
}

const mockPerfil = {
  id: ID,
  nombre: "Ana García",
  hijos: [{ id: "h-1", nombre: "Sofía", fecha_nacimiento: "2018-06-01" }],
  eventos: [],
};

beforeEach(() => jest.clearAllMocks());

// ── GET /api/clientes/[id] ────────────────────────────────────────────────────

describe("GET /api/clientes/[id]", () => {
  it("returns 200 with full profile", async () => {
    mockFrom.mockReturnValue(chain({ data: mockPerfil, error: null }));

    const res = await GET(req("GET"), params);
    expect(res.status).toBe(200);
    expect((await res.json()).nombre).toBe("Ana García");
  });

  it("returns 404 on PGRST116", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Not found", code: "PGRST116" } }));

    const res = await GET(req("GET"), params);
    expect(res.status).toBe(404);
  });

  it("returns 500 on other DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Server error", code: "50000" } }));

    const res = await GET(req("GET"), params);
    expect(res.status).toBe(500);
  });
});

// ── PUT /api/clientes/[id] ────────────────────────────────────────────────────

describe("PUT /api/clientes/[id]", () => {
  it("returns 200 with updated cliente", async () => {
    const updated = { ...mockPerfil, nombre: "Ana López" };
    mockFrom.mockReturnValue(chain({ data: updated, error: null }));

    const res = await PUT(req("PUT", { nombre: "Ana López" }), params);
    expect(res.status).toBe(200);
    expect((await res.json()).nombre).toBe("Ana López");
  });

  it("returns 404 when not found", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Not found", code: "PGRST116" } }));

    const res = await PUT(req("PUT", { nombre: "X" }), params);
    expect(res.status).toBe(404);
  });

  it("returns 400 on DB constraint error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Constraint", code: "23000" } }));

    const res = await PUT(req("PUT", { nombre: "X" }), params);
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest(`http://localhost/api/clientes/${ID}`, {
      method: "PUT",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(badReq, params);
    expect(res.status).toBe(400);
  });

  // ── email validation ──

  it("returns 400 when email format is invalid", async () => {
    const res = await PUT(req("PUT", { email: "bad-email" }), params);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/email/i);
  });

  it("accepts valid email on PUT", async () => {
    mockFrom.mockReturnValue(chain({ data: mockPerfil, error: null }));

    const res = await PUT(req("PUT", { email: "valid@example.com" }), params);
    expect(res.status).toBe(200);
  });

  it("allows omitting email on PUT (partial update)", async () => {
    mockFrom.mockReturnValue(chain({ data: mockPerfil, error: null }));

    const res = await PUT(req("PUT", { nombre: "Nuevo nombre" }), params);
    expect(res.status).toBe(200);
  });

  // ── phone validation ──

  it("returns 400 when phone format is invalid on PUT", async () => {
    const res = await PUT(req("PUT", { telefono: "abc" }), params);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/tel[eé]fono/i);
  });

  it("accepts valid phone on PUT", async () => {
    mockFrom.mockReturnValue(chain({ data: mockPerfil, error: null }));

    const res = await PUT(req("PUT", { telefono: "+525551234567" }), params);
    expect(res.status).toBe(200);
  });
});

// ── DELETE /api/clientes/[id] ─────────────────────────────────────────────────

describe("DELETE /api/clientes/[id]", () => {
  it("returns 204 on success", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(204);
  });

  it("returns 400 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "FK constraint" } }));

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(400);
  });
});
