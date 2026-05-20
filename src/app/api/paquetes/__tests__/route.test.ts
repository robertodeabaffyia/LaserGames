/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

const mockFrom = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

// Builds a Supabase-like thenable chain where every method returns itself.
// The chain resolves to `result` when awaited.
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
  return new NextRequest("http://localhost/api/paquetes", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  });
}

const mockPaquete = {
  id: "pkg-1",
  nombre: "Paquete Básico",
  descripcion: null,
  precio: 500,
  duracion_horas: 2,
  max_invitados: 20,
  es_activo: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => jest.clearAllMocks());

// ── GET /api/paquetes ─────────────────────────────────────────────────────────

describe("GET /api/paquetes", () => {
  it("returns 200 with list of packages", async () => {
    mockFrom.mockReturnValue(chain({ data: [mockPaquete], error: null }));

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([mockPaquete]);
    expect(mockFrom).toHaveBeenCalledWith("paquetes");
  });

  it("returns 500 on database error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "DB error" } }));

    const res = await GET();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("DB error");
  });
});

// ── POST /api/paquetes ────────────────────────────────────────────────────────

describe("POST /api/paquetes", () => {
  it("returns 201 and the created package (no items)", async () => {
    mockFrom.mockReturnValue(chain({ data: mockPaquete, error: null }));

    const res = await POST(req("POST", { nombre: "Paquete Básico", precio: 500 }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(mockPaquete);
  });

  it("inserts paquete_items when items array is provided", async () => {
    const paquetesChain = chain({ data: mockPaquete, error: null });
    const paqueteItemsChain = chain({ data: null, error: null });

    mockFrom.mockImplementation((table: string) =>
      table === "paquetes" ? paquetesChain : paqueteItemsChain
    );

    const res = await POST(
      req("POST", {
        nombre: "Paquete Premium",
        precio: 1000,
        items: [{ item_id: "item-1", cantidad: 2 }],
      })
    );

    expect(res.status).toBe(201);
    expect(mockFrom).toHaveBeenCalledWith("paquete_items");
    expect(paqueteItemsChain.insert).toHaveBeenCalledWith([
      { paquete_id: "pkg-1", item_id: "item-1", cantidad: 2 },
    ]);
  });

  it("returns 400 when nombre is missing", async () => {
    const res = await POST(req("POST", { precio: 500 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/nombre/);
  });

  it("returns 400 when precio is missing", async () => {
    const res = await POST(req("POST", { nombre: "Test" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on database insert error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Unique violation" } }));

    const res = await POST(req("POST", { nombre: "Dup", precio: 100 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Unique violation");
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest("http://localhost/api/paquetes", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });
});
