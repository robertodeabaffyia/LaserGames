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

/** Shared mock chains for recalcularEstadoEvento (no estado change). */
function recalcNoChange() {
  mockFrom
    .mockReturnValueOnce(
      chain({ data: { id: "ev-1", precio_total: 3000, estado: "pendiente" }, error: null })
    )
    .mockReturnValueOnce(
      chain({ data: [{ monto: 1000, monto_final: null }], error: null })
    )
    .mockReturnValueOnce(
      chain({ data: { monto_seña: 2000 }, error: null })
    );
  // totalPagado (1000) < montoSena (2000) → pendiente = current estado → no update
}

/** Recalc chains that trigger an estado update. */
function recalcWithUpdate(
  currentEstado: string,
  pagos: { monto: number; monto_final: number | null }[],
  montoSena: number,
  precioTotal: number
) {
  const updateChain = chain({ data: null, error: null });
  mockFrom
    .mockReturnValueOnce(
      chain({ data: { id: "ev-1", precio_total: precioTotal, estado: currentEstado }, error: null })
    )
    .mockReturnValueOnce(chain({ data: pagos, error: null }))
    .mockReturnValueOnce(chain({ data: { monto_seña: montoSena }, error: null }))
    .mockReturnValueOnce(updateChain);
  return updateChain;
}

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

  it("returns 403 when user is general (editing pagos is supervisor+)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const { getUserRol } = jest.requireMock("@/lib/auth-helpers");
    (getUserRol as jest.Mock).mockResolvedValueOnce("general");

    const res = await PUT(req("PUT", { notas: "ref-123" }), params);
    expect(res.status).toBe(403);
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

  it("updates notas and quien_recibio — does NOT sync movimiento_caja", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const updated = { ...mockPago, notas: "ref-456", quien_recibio: "María" };
    const updateChain = chain({ data: updated, error: null });

    mockFrom
      .mockReturnValueOnce(chain({ data: mockPago, error: null })) // fetch existing
      .mockReturnValueOnce(updateChain);                            // update pago
    recalcNoChange();
    // No extra from() call — movimiento sync only fires on monto/fecha_pago change

    const res = await PUT(req("PUT", { notas: "ref-456", quien_recibio: "María" }), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notas).toBe("ref-456");
    expect(body.quien_recibio).toBe("María");
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ notas: "ref-456", quien_recibio: "María" })
    );
  });

  it("updates fecha_pago and syncs movimiento_caja fecha", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const newDate = "2026-07-01T09:00:00Z";
    const updated = { ...mockPago, fecha_pago: newDate };
    const updateChain = chain({ data: updated, error: null });
    const movUpdateChain = chain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(chain({ data: mockPago, error: null }))
      .mockReturnValueOnce(updateChain);
    recalcNoChange();
    mockFrom.mockReturnValueOnce(movUpdateChain); // movimiento_caja date sync

    const res = await PUT(req("PUT", { fecha_pago: newDate }), params);
    expect(res.status).toBe(200);
    expect((await res.json()).fecha_pago).toBe(newDate);
    expect(movUpdateChain.update).toHaveBeenCalledWith({ fecha: "2026-07-01" });
    expect(movUpdateChain.eq).toHaveBeenCalledWith("pago_id", ID);
  });

  it("returns 400 when updated monto is 0 or negative", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: mockPago, error: null }));

    const res = await PUT(req("PUT", { monto: 0 }), params);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/monto/);
  });

  it("updates monto without discount — re-evaluates evento estado and syncs movimiento_caja", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const updated = { ...mockPago, monto: 3000 };
    const updateChain = chain({ data: updated, error: null });
    const movUpdateChain = chain({ data: null, error: null });
    const mockConfig = { monto_seña: 1000, tarjeta_recargos: {} };

    mockFrom
      .mockReturnValueOnce(chain({ data: mockPago, error: null }))              // fetch pago
      .mockReturnValueOnce(updateChain)                                          // update pago
      // recalcularEstadoEvento:
      .mockReturnValueOnce(chain({ data: { id: "ev-1", precio_total: 3000, estado: "pendiente" }, error: null }))
      .mockReturnValueOnce(chain({ data: [{ monto: 3000, monto_final: null }], error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))                  // update evento
      .mockReturnValueOnce(movUpdateChain);                                      // movimiento_caja monto sync

    const res = await PUT(req("PUT", { monto: 3000 }), params);
    expect(res.status).toBe(200);
    expect(movUpdateChain.update).toHaveBeenCalledWith({ monto: 3000 });
    expect(movUpdateChain.eq).toHaveBeenCalledWith("pago_id", ID);
  });

  it("recomputes monto_final when monto changes and discount exists — syncs monto_final to movimiento_caja", async () => {
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
    const movUpdateChain = chain({ data: null, error: null });
    const mockConfig = { monto_seña: 1000, tarjeta_recargos: {} };

    mockFrom
      .mockReturnValueOnce(chain({ data: pagoConDescuento, error: null }))
      .mockReturnValueOnce(updateChain)
      // recalcularEstadoEvento:
      .mockReturnValueOnce(chain({ data: { id: "ev-1", precio_total: 3000, estado: "pendiente" }, error: null }))
      .mockReturnValueOnce(chain({ data: [{ monto: 2000, monto_final: 1800 }], error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValueOnce(movUpdateChain);                                      // movimiento_caja sync

    const res = await PUT(req("PUT", { monto: 2000 }), params);
    expect(res.status).toBe(200);
    // pago update uses monto_final = 1800
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ monto: 2000, monto_final: 1800 })
    );
    // movimiento_caja synced with effective (discounted) amount
    expect(movUpdateChain.update).toHaveBeenCalledWith({ monto: 1800 });
    expect(movUpdateChain.eq).toHaveBeenCalledWith("pago_id", ID);
  });

  it("reverts completado → pendiente when monto is reduced below seña — syncs movimiento_caja", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const updatedPago = { ...mockPago, monto: 400 };
    const updateChain = chain({ data: updatedPago, error: null });
    const movUpdateChain = chain({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(chain({ data: mockPago, error: null })) // fetch pago (monto=1000)
      .mockReturnValueOnce(updateChain);                            // update pago

    const estadoUpdateChain = recalcWithUpdate(
      "completado",
      [{ monto: 400, monto_final: null }], // only remaining pago
      1000,
      3000
    );
    mockFrom.mockReturnValueOnce(movUpdateChain); // movimiento_caja monto sync

    const res = await PUT(req("PUT", { monto: 400 }), params);
    expect(res.status).toBe(200);
    // 400 < 1000 (seña) → pendiente
    expect(estadoUpdateChain.update).toHaveBeenCalledWith({ estado: "pendiente" });
    expect(movUpdateChain.update).toHaveBeenCalledWith({ monto: 400 });
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
//
// DELETE order: fetch pago → delete movimiento_caja (by pago_id) → delete pago
// → recalcularEstadoEvento. The movimiento delete is a no-op for old rows
// without pago_id (0 rows affected ≠ error in Supabase).

describe("DELETE /api/pagos/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(401);
  });

  it("returns 204 on successful delete — removes paired movimiento_caja then pago", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const delMovChain = chain({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: ID, evento_id: "ev-1" }, error: null })) // fetch
      .mockReturnValueOnce(delMovChain)                                                  // delete movimiento
      .mockReturnValueOnce(chain({ data: null, error: null }));                          // delete pago
    recalcNoChange();

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(204);
    expect(delMovChain.delete).toHaveBeenCalled();
    expect(delMovChain.eq).toHaveBeenCalledWith("pago_id", ID);
  });

  it("returns 404 when pago not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValueOnce(
      chain({ data: null, error: { message: "Not found", code: "PGRST116" } })
    );

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(404);
  });

  it("returns 500 when movimiento_caja delete fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: ID, evento_id: "ev-1" }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: "DB error" } })); // movimiento delete fails

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/movimiento/i);
  });

  it("returns 400 on pago DB delete error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: ID, evento_id: "ev-1" }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))                           // movimiento delete OK
      .mockReturnValueOnce(chain({ data: null, error: { message: "FK constraint" } })); // pago delete fails

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(400);
  });

  it("reverts completado → pendiente when last payment is deleted", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: ID, evento_id: "ev-1" }, error: null })) // fetch
      .mockReturnValueOnce(chain({ data: null, error: null }))                           // delete movimiento
      .mockReturnValueOnce(chain({ data: null, error: null }));                          // delete pago

    const estadoUpdateChain = recalcWithUpdate(
      "completado",
      [], // no pagos left
      1000,
      3000
    );

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(204);
    expect(estadoUpdateChain.update).toHaveBeenCalledWith({ estado: "pendiente" });
  });

  it("reverts completado → confirmado when partial payment covering seña remains", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: ID, evento_id: "ev-1" }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null })) // delete movimiento
      .mockReturnValueOnce(chain({ data: null, error: null })); // delete pago

    const estadoUpdateChain = recalcWithUpdate(
      "completado",
      [{ monto: 1500, monto_final: null }], // remaining pago covers seña but not total
      1000,
      3000
    );

    await DELETE(req("DELETE"), params);
    expect(estadoUpdateChain.update).toHaveBeenCalledWith({ estado: "confirmado" });
  });

  it("reverts completado → pendiente when remaining payments are below seña", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: ID, evento_id: "ev-1" }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null })) // delete movimiento
      .mockReturnValueOnce(chain({ data: null, error: null })); // delete pago

    const estadoUpdateChain = recalcWithUpdate(
      "completado",
      [{ monto: 400, monto_final: null }], // below 1000 seña
      1000,
      3000
    );

    await DELETE(req("DELETE"), params);
    expect(estadoUpdateChain.update).toHaveBeenCalledWith({ estado: "pendiente" });
  });
});
