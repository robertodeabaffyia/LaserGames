/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

const mockFrom = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "insert", "update", "delete", "eq", "or", "in", "order", "single", "limit", "filter"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const mockCliente = {
  id: "cli-1",
  nombre: "Ana García",
  telefono: "5551234567",
  email: "ana@test.com",
  fecha_cumpleanos: "1990-03-15",
  notas: null,
  hijos: [],
};

beforeEach(() => jest.clearAllMocks());

// ── GET /api/clientes ─────────────────────────────────────────────────────────

describe("GET /api/clientes", () => {
  it("returns 200 with list (no search)", async () => {
    mockFrom.mockReturnValue(chain({ data: [mockCliente], error: null }));

    const req = new NextRequest("http://localhost/api/clientes");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([mockCliente]);
    expect(mockFrom).toHaveBeenCalledWith("clientes");
  });

  it("applies .or() filter when q param is present", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    const req = new NextRequest("http://localhost/api/clientes?q=ana");
    await GET(req);

    expect(c.or).toHaveBeenCalledWith(
      "nombre.ilike.%ana%,telefono.ilike.%ana%,email.ilike.%ana%"
    );
  });

  it("applies .filter() when colegio param is present", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    const req = new NextRequest("http://localhost/api/clientes?colegio=San+José");
    await GET(req);

    expect(c.filter).toHaveBeenCalledWith("hijos.colegio", "ilike", "%San José%");
  });

  it("returns 500 on database error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "DB error" } }));

    const req = new NextRequest("http://localhost/api/clientes");
    const res = await GET(req);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("DB error");
  });
});

// ── POST /api/clientes ────────────────────────────────────────────────────────

describe("POST /api/clientes", () => {
  function req(body: unknown) {
    return new NextRequest("http://localhost/api/clientes", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  it("returns 201 with created cliente", async () => {
    mockFrom.mockReturnValue(chain({ data: mockCliente, error: null }));

    const res = await POST(req({ nombre: "Ana García", telefono: "5551234567" }));
    expect(res.status).toBe(201);
    expect((await res.json()).nombre).toBe("Ana García");
  });

  it("returns 400 when nombre is missing", async () => {
    const res = await POST(req({ telefono: "555" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/nombre/);
  });

  it("returns 400 on database error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Constraint" } }));

    const res = await POST(req({ nombre: "Test" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest("http://localhost/api/clientes", {
      method: "POST",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });
});
