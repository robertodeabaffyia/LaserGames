/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { PUT, DELETE } from "../route";

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
  for (const m of ["select", "insert", "update", "delete", "eq", "order", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const ID = "pago-1";
const params = { params: Promise.resolve({ id: ID }) };

const mockPago = {
  id: ID,
  evento_id: "ev-1",
  monto: 1000,
  metodo: "efectivo",
  tipo_tarjeta: null,
  num_cuotas: null,
  recargo_pct: 0,
  notas: null,
  quien_recibio: null,
  tiene_descuento: false,
  tipo_descuento: null,
  valor_descuento: null,
  monto_final: null,
  fecha_pago: "2026-06-01T10:00:00Z",
  created_at: "2026-06-01T10:00:00Z",
};

function req(method: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/pagos/${ID}`, {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

beforeEach(() => jest.clearAllMocks());

// ── PUT /api/pagos/[id] ───────────────────────────────────────────────────────

describe("PUT /api/pagos/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await PUT(req("PUT", { notas: "ref-123" }), params);
    expect(res.status).toBe(401);
  });

  it("returns 404 when pago not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValueOnce(
      chain({ data: null, error: { message: "Not found", code: "PGRST116" } })
    );

    const res = await PUT(req("PUT", { notas: "ref-123" }), params);
    expect(res.status).toBe(404);
  });

  it("returns 400 on invalid JSON", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const badReq = new NextRequest(`http://localhost/api/pagos/${ID}`, {
      method: "PUT",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(badReq, params);
    expect(res.status).toBe(400);
  });

  it("returns 400 when no updatable fields provided", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: mockPago, error: null })); // fetch pago

    const res = await PUT(req("PUT", {}), params);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/No updatable/);
  });

  it("updates notas and quien_recibio (simple fields)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const updated = { ...mockPago, notas: "ref-456", quien_recibio: "María" };
    const updateChain = chain({ data: updated, error: null });

    mockFrom
      .mockReturnValueOnce(chain({ data: mockPago, error: null })) // fetch existing
      .mockReturnValueOnce(updateChain);                            // update

    const res = await PUT(req("PUT", { notas: "ref-456", quien_recibio: "María" }), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notas).toBe("ref-456");
    expect(body.quien_recibio).toBe("María");
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ notas: "ref-456", quien_recibio: "María" })
    );
  });

  it("updates fecha_pago", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const newDate = "2026-07-01T09:00:00Z";
    const updated = { ...mockPago, fecha_pago: newDate };
    const updateChain = chain({ data: updated, error: null });

    mockFrom
      .mockReturnValueOnce(chain({ data: mockPago, error: null }))
      .mockReturnValueOnce(updateChain);

    const res = await PUT(req("PUT", { fecha_pago: newDate }), params);
    expect(res.status).toBe(200);
    expect((await res.json()).fecha_pago).toBe(newDate);
  });

  it("returns 400 when updated monto is 0 or negative", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: mockPago, error: null }));

    const res = await PUT(req("PUT", { monto: 0 }), params);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/monto/);
  });

  it("updates monto without discount — re-evaluates evento estado", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const updated = { ...mockPago, monto: 3000 };
    const updateChain = chain({ data: updated, error: null });
    const mockEvento = { id: "ev-1", precio_total: 3000, estado: "pendiente" };
    const mockConfig = { monto_seña: 1000, tarjeta_recargos: {} };

    mockFrom
      .mockReturnValueOnce(chain({ data: mockPago, error: null }))              // fetch pago
      .mockReturnValueOnce(updateChain)                                          // update pago
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))            // fetch evento
      .mockReturnValueOnce(chain({ data: [{ monto: 3000, monto_final: null }], error: null })) // all pagos
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))            // fetch config
      .mockReturnValueOnce(chain({ data: null, error: null }));                 // update evento

    const res = await PUT(req("PUT", { monto: 3000 }), params);
    expect(res.status).toBe(200);
  });

  it("recomputes monto_final when monto changes and discount exists", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const pagoConDescuento = {
      ...mockPago,
      tiene_descuento: true,
      tipo_descuento: "porcentaje",
      valor_descuento: 10,
      monto_final: 900, // was 1000 * 0.9
    };
    const updateChain = chain({
      data: { ...pagoConDescuento, monto: 2000, monto_final: 1800 },
      error: null,
    });
    const mockEvento = { id: "ev-1", precio_total: 3000, estado: "pendiente" };
    const mockConfig = { monto_seña: 1000, tarjeta_recargos: {} };

    mockFrom
      .mockReturnValueOnce(chain({ data: pagoConDescuento, error: null }))
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: [{ monto: 2000, monto_final: 1800 }], error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await PUT(req("PUT", { monto: 2000 }), params);
    expect(res.status).toBe(200);
    // monto_final = 2000 - 10% = 1800
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ monto: 2000, monto_final: 1800 })
    );
  });

  it("returns 400 when DB update fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockPago, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: "Constraint", code: "23000" } }));

    const res = await PUT(req("PUT", { notas: "x" }), params);
    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/pagos/[id] ────────────────────────────────────────────────────

describe("DELETE /api/pagos/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(401);
  });

  it("returns 204 on successful delete", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: ID, evento_id: "ev-1" }, error: null })) // fetch
      .mockReturnValueOnce(chain({ data: null, error: null }));                          // delete

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(204);
  });

  it("returns 404 when pago not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValueOnce(
      chain({ data: null, error: { message: "Not found", code: "PGRST116" } })
    );

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(404);
  });

  it("returns 400 on DB delete error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: ID, evento_id: "ev-1" }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: "FK constraint" } }));

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(400);
  });
});
