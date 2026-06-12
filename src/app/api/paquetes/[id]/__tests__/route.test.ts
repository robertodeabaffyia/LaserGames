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

const ID = "pkg-1";
const params = { params: Promise.resolve({ id: ID }) };

function req(method: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/paquetes/${ID}`, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } } : {}),
  });
}

const mockPaquete = {
  id: ID,
  nombre: "Paquete Básico",
  precio: 500,
  duracion_horas: 2,
  duracion_minutos: 0,
  cantidad_ninos_incluidos: 10,
  cantidad_adultos_incluidos: 2,
  es_activo: true,
  paquete_items: [],
};

beforeEach(() => jest.clearAllMocks());

// ── GET /api/paquetes/[id] ────────────────────────────────────────────────────

describe("GET /api/paquetes/[id]", () => {
  it("returns 200 with the package", async () => {
    mockFrom.mockReturnValue(chain({ data: mockPaquete, error: null }));

    const res = await GET(req("GET"), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockPaquete);
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

// ── PUT /api/paquetes/[id] ────────────────────────────────────────────────────

describe("PUT /api/paquetes/[id]", () => {
  it("returns 200 with updated package (no items key)", async () => {
    mockFrom.mockReturnValue(chain({ data: mockPaquete, error: null }));

    const res = await PUT(req("PUT", { nombre: "Actualizado" }), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(mockPaquete);
  });

  it("replaces paquete_items when items array is provided", async () => {
    const paquetesChain = chain({ data: mockPaquete, error: null });
    const paqueteItemsChain = chain({ data: null, error: null });

    mockFrom.mockImplementation((table: string) =>
      table === "paquetes" ? paquetesChain : paqueteItemsChain
    );

    const res = await PUT(
      req("PUT", { nombre: "Actualizado", items: [{ item_id: "item-2", cantidad: 3 }] }),
      params
    );

    expect(res.status).toBe(200);
    expect(paqueteItemsChain.delete).toHaveBeenCalled();
    expect(paqueteItemsChain.insert).toHaveBeenCalledWith([
      { paquete_id: ID, item_id: "item-2", cantidad: 3 },
    ]);
  });

  it("clears items when empty items array is provided", async () => {
    const paquetesChain = chain({ data: mockPaquete, error: null });
    const paqueteItemsChain = chain({ data: null, error: null });

    mockFrom.mockImplementation((table: string) =>
      table === "paquetes" ? paquetesChain : paqueteItemsChain
    );

    await PUT(req("PUT", { nombre: "Actualizado", items: [] }), params);

    expect(paqueteItemsChain.delete).toHaveBeenCalled();
    expect(paqueteItemsChain.insert).not.toHaveBeenCalled();
  });

  it("returns 404 when package not found", async () => {
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
    const badReq = new NextRequest(`http://localhost/api/paquetes/${ID}`, {
      method: "PUT",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(badReq, params);
    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/paquetes/[id] ─────────────────────────────────────────────────

describe("DELETE /api/paquetes/[id]", () => {
  it("returns 204 on success", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(204);
    expect(mockFrom).toHaveBeenCalledWith("paquetes");
  });

  it("returns 400 on database error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Foreign key constraint" } }));

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(400);
  });
});
