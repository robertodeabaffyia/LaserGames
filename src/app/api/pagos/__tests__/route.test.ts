/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

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

const mockEvento = { id: "ev-1", precio_total: 3000, estado: "pendiente" };
const mockConfig = { monto_seña: 1000, tarjeta_recargos: { VISA: { "1": 0, "3": 3.5 } } };
const mockPago = {
  id: "pago-1",
  evento_id: "ev-1",
  monto: 1000,
  metodo: "efectivo",
  tipo_tarjeta: null,
  num_cuotas: null,
  recargo_pct: 0,
  notas: null,
  tiene_descuento: false,
  tipo_descuento: null,
  valor_descuento: null,
  monto_final: null,
  fecha_pago: "2026-06-01T10:00:00Z",
  created_at: "2026-06-01T10:00:00Z",
};

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/pagos", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => jest.clearAllMocks());

// ── GET ────────────────────────────────────────────────────────────────────────

describe("GET /api/pagos", () => {
  it("returns list of pagos", async () => {
    mockFrom.mockReturnValue(chain({ data: [mockPago], error: null }));

    const res = await GET(new NextRequest("http://localhost/api/pagos"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].monto).toBe(1000);
  });

  it("filters by evento_id", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(new NextRequest("http://localhost/api/pagos?evento_id=ev-1"));
    expect(c.eq).toHaveBeenCalledWith("evento_id", "ev-1");
  });

  it("returns 500 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "DB error" } }));

    const res = await GET(new NextRequest("http://localhost/api/pagos"));
    expect(res.status).toBe(500);
  });
});

// ── POST — existing behaviour ──────────────────────────────────────────────────

describe("POST /api/pagos", () => {
  const validBody = { evento_id: "ev-1", monto: 1000, metodo: "efectivo" };

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 201 with new pago", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))          // fetch evento
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))           // fetch config
      .mockReturnValueOnce(chain({ data: [], error: null }))                   // existing pagos
      .mockReturnValueOnce(chain({ data: mockPago, error: null }))             // insert pago
      .mockReturnValueOnce(chain({ data: null, error: null }))                 // update evento
      .mockReturnValueOnce(chain({ data: null, error: null }));                // insert movimiento_caja

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.monto).toBe(1000);
    expect(body.evento_estado).toBe("confirmado");
  });

  it("sets evento to completado when fully paid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const existingPagos = [{ monto: 2000, monto_final: null }];
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: existingPagos, error: null }))
      .mockReturnValueOnce(chain({ data: { ...mockPago, monto: 1000 }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))                 // update evento
      .mockReturnValueOnce(chain({ data: null, error: null }));                // insert movimiento_caja

    const res = await POST(postReq({ evento_id: "ev-1", monto: 1000, metodo: "efectivo" }));
    expect(res.status).toBe(201);
    expect((await res.json()).evento_estado).toBe("completado");
  });

  it("does not change estado when partial payment and no seña config", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const configNoSeña = { monto_seña: 0, tarjeta_recargos: {} };
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: configNoSeña, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: mockPago, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }));               // insert movimiento_caja

    const res = await POST(postReq({ evento_id: "ev-1", monto: 500, metodo: "efectivo" }));
    expect(res.status).toBe(201);
    expect((await res.json()).evento_estado).toBe("pendiente");
  });

  it("calculates recargo_pct for tarjeta payment", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const insertChain = chain({
      data: { ...mockPago, metodo: "tarjeta", tipo_tarjeta: "VISA", num_cuotas: 3, recargo_pct: 3.5 },
      error: null,
    });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }));

    await POST(postReq({ evento_id: "ev-1", monto: 1000, metodo: "tarjeta", tipo_tarjeta: "VISA", num_cuotas: 3 }));
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ recargo_pct: 3.5 })
    );
  });

  it("returns 400 when evento_id is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const res = await POST(postReq({ monto: 500, metodo: "efectivo" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/evento_id/);
  });

  it("returns 400 when monto is 0 or missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const res = await POST(postReq({ evento_id: "ev-1", monto: 0, metodo: "efectivo" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/monto/);
  });

  it("returns 400 when metodo is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const res = await POST(postReq({ evento_id: "ev-1", monto: 500 }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when evento is not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValueOnce(
      chain({ data: null, error: { message: "Not found", code: "PGRST116" } })
    );

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(404);
  });

  it("returns 400 on pago insert error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: "Constraint" } }));

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const badReq = new NextRequest("http://localhost/api/pagos", {
      method: "POST",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });

  it("creates movimiento_caja ingreso after successful pago insert", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const movimientoChain = chain({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: mockPago, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))                // update evento
      .mockReturnValueOnce(movimientoChain);                                   // movimiento_caja

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(201);
    expect(movimientoChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "ingreso",
        categoria: "pago_evento",
        evento_id: "ev-1",
        monto: 1000,    // montoFinal = body.monto when no discount
      })
    );
  });
});

// ── POST — descuento validation ───────────────────────────────────────────────

describe("POST /api/pagos — descuentos", () => {
  const base = { evento_id: "ev-1", monto: 1000, metodo: "efectivo" };

  function authed() {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  }

  it("returns 400 when tiene_descuento but tipo_descuento is missing", async () => {
    authed();
    const res = await POST(postReq({ ...base, tiene_descuento: true, valor_descuento: 10 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/tipo_descuento/);
  });

  it("returns 400 when tiene_descuento but tipo_descuento is invalid", async () => {
    authed();
    const res = await POST(postReq({ ...base, tiene_descuento: true, tipo_descuento: "invalido", valor_descuento: 10 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/tipo_descuento/);
  });

  it("returns 400 when tiene_descuento but valor_descuento is missing", async () => {
    authed();
    const res = await POST(postReq({ ...base, tiene_descuento: true, tipo_descuento: "porcentaje" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/valor_descuento/);
  });

  it("returns 400 when tiene_descuento but valor_descuento is 0", async () => {
    authed();
    const res = await POST(postReq({ ...base, tiene_descuento: true, tipo_descuento: "monto", valor_descuento: 0 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/valor_descuento/);
  });

  it("returns 400 when porcentaje descuento > 100", async () => {
    authed();
    const res = await POST(postReq({ ...base, tiene_descuento: true, tipo_descuento: "porcentaje", valor_descuento: 110 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/100/);
  });

  it("returns 400 when monto_final <= 0 after discount", async () => {
    authed();
    // monto=1000, descuento monto=1000 → monto_final=0
    const res = await POST(postReq({ ...base, tiene_descuento: true, tipo_descuento: "monto", valor_descuento: 1000 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/monto_final/);
  });

  it("inserts pago with monto_final for porcentaje discount and uses it in movimiento_caja", async () => {
    authed();
    // monto=1000, 10% descuento → monto_final=900
    const mockPagoDescuento = {
      ...mockPago,
      tiene_descuento: true,
      tipo_descuento: "porcentaje",
      valor_descuento: 10,
      monto_final: 900,
    };
    const insertChain = chain({ data: mockPagoDescuento, error: null });
    const movimientoChain = chain({ data: null, error: null });

    // montoFinal=900 < montoSeña=1000 → no estado update
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(movimientoChain);                                   // movimiento_caja (no update evento)

    const res = await POST(postReq({ ...base, tiene_descuento: true, tipo_descuento: "porcentaje", valor_descuento: 10 }));
    expect(res.status).toBe(201);

    // Insert stores base monto + discount fields + computed monto_final
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        monto: 1000,
        tiene_descuento: true,
        tipo_descuento: "porcentaje",
        valor_descuento: 10,
        monto_final: 900,
      })
    );

    // movimiento_caja uses monto_final (900), not base monto (1000)
    expect(movimientoChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ monto: 900 })
    );
  });

  it("inserts pago with monto_final for monto fijo discount", async () => {
    authed();
    // monto=1000, fixed $200 → monto_final=800
    const insertChain = chain({ data: { ...mockPago, monto_final: 800 }, error: null });
    // montoFinal=800 < montoSeña=1000 → no estado update
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(chain({ data: null, error: null }));               // movimiento_caja only

    const res = await POST(postReq({ ...base, tiene_descuento: true, tipo_descuento: "monto", valor_descuento: 200 }));
    expect(res.status).toBe(201);
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ monto_final: 800, tipo_descuento: "monto", valor_descuento: 200 })
    );
  });

  it("evento balance uses monto_final from existing pagos", async () => {
    authed();
    // existing pagos: one has monto_final=900 (discounted), one has monto_final=null (legacy → monto=1500)
    // total before = 900 + 1500 = 2400
    // new payment: monto=600, no discount → monto_final=600
    // total after = 2400 + 600 = 3000 >= precio_total(3000) → completado
    const existingPagos = [
      { monto: 1000, monto_final: 900 },
      { monto: 1500, monto_final: null },
    ];
    const updateChain = chain({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: existingPagos, error: null }))
      .mockReturnValueOnce(chain({ data: mockPago, error: null }))
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await POST(postReq({ evento_id: "ev-1", monto: 600, metodo: "efectivo" }));
    expect(res.status).toBe(201);
    expect((await res.json()).evento_estado).toBe("completado");
    expect(updateChain.update).toHaveBeenCalledWith({ estado: "completado" });
  });

  it("no descuento fields are stored when tiene_descuento is false", async () => {
    authed();
    const insertChain = chain({ data: mockPago, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }));

    await POST(postReq({ ...base, tiene_descuento: false }));
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tiene_descuento: false,
        tipo_descuento: null,
        valor_descuento: null,
        monto_final: null,
      })
    );
  });
});

// ── POST — quien_recibio ──────────────────────────────────────────────────────

describe("POST /api/pagos — quien_recibio", () => {
  const base = { evento_id: "ev-1", monto: 1000, metodo: "efectivo" };

  it("stores quien_recibio when provided", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const insertChain = chain({ data: { ...mockPago, quien_recibio: "Carlos" }, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(chain({ data: null, error: null })) // update evento
      .mockReturnValueOnce(chain({ data: null, error: null })); // movimiento_caja

    const res = await POST(postReq({ ...base, quien_recibio: "Carlos" }));
    expect(res.status).toBe(201);
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ quien_recibio: "Carlos" })
    );
  });

  it("stores quien_recibio as null when not provided", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const insertChain = chain({ data: mockPago, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }));

    await POST(postReq(base));
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ quien_recibio: null })
    );
  });
});
