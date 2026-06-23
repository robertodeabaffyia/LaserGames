/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST } from "../route";
import { recalcularEstadoEvento } from "@/lib/pagos";

const mockFrom = jest.fn();
const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({ from: mockFrom, auth: { getUser: mockGetUser } })
  ),
}));

// recalcularEstadoEvento is the shared helper used by POST, PUT, and DELETE.
// Mocked here so POST tests stay focused on routing behaviour; the recalc
// logic itself is covered in src/lib/__tests__/pagos.test.ts.
jest.mock("@/lib/pagos", () => ({
  recalcularEstadoEvento: jest.fn(),
}));
const mockRecalcularEstadoEvento = recalcularEstadoEvento as jest.Mock;

// getUserRol is mocked to avoid an extra mockFrom call in every test.
// Default: "general" (non-admin). Individual tests override for admin scenarios.
jest.mock("@/lib/auth-helpers", () => {
  const actual = jest.requireActual("@/lib/auth-helpers");
  return { ...actual, getUserRol: jest.fn().mockResolvedValue("general") };
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

const mockEvento = { id: "ev-1", precio_total: 3000, estado: "pendiente", nombre_festejado: "Mateo" };
const mockConfig = {
  monto_seña: 1000,
  tarjeta_recargos: { VISA: { "1": 0, "3": 3.5 } },
  recargo_transferencia_pct: 2.5,
};
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

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  // Default: recalc returns "pendiente"; individual tests override when needed.
  mockRecalcularEstadoEvento.mockResolvedValue("pendiente");
});

// ── GET ────────────────────────────────────────────────────────────────────────

describe("GET /api/pagos", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(new NextRequest("http://localhost/api/pagos"));
    expect(res.status).toBe(401);
  });

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

// ── POST — core behaviour ──────────────────────────────────────────────────────
//
// Mock chain for a successful POST (recalcularEstadoEvento mocked at module level):
//   1. fetch evento
//   2. fetch config (tarjeta_recargos only)
//   3. insert pago
//   4. insert movimiento_caja
//
// Previously the chain also contained: fetch existingPagos + update evento.
// Both are now internal to recalcularEstadoEvento and not visible here.

describe("POST /api/pagos", () => {
  const validBody = { evento_id: "ev-1", monto: 1000, metodo: "efectivo" };

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 201 with new pago and evento_estado from recalcularEstadoEvento", async () => {
    mockRecalcularEstadoEvento.mockResolvedValue("confirmado");
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))  // fetch evento
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))  // fetch config
      .mockReturnValueOnce(chain({ data: mockPago, error: null }))    // insert pago
      .mockReturnValueOnce(chain({ data: null, error: null }));       // movimiento_caja

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.monto).toBe(1000);
    expect(body.evento_estado).toBe("confirmado");
  });

  it("sets evento to completado when recalcularEstadoEvento returns completado", async () => {
    mockRecalcularEstadoEvento.mockResolvedValue("completado");
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: { ...mockPago, monto: 1000 }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await POST(postReq({ evento_id: "ev-1", monto: 1000, metodo: "efectivo" }));
    expect(res.status).toBe(201);
    expect((await res.json()).evento_estado).toBe("completado");
  });

  it("returns pendiente when recalcularEstadoEvento returns pendiente", async () => {
    const configNoSeña = { monto_seña: 0, tarjeta_recargos: {} };
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: configNoSeña, error: null }))
      .mockReturnValueOnce(chain({ data: mockPago, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await POST(postReq({ evento_id: "ev-1", monto: 500, metodo: "efectivo" }));
    expect(res.status).toBe(201);
    expect((await res.json()).evento_estado).toBe("pendiente");
  });

  it("calculates recargo_pct for tarjeta payment", async () => {
    mockRecalcularEstadoEvento.mockResolvedValue("confirmado");
    const insertChain = chain({
      data: { ...mockPago, metodo: "tarjeta", tipo_tarjeta: "VISA", num_cuotas: 3, recargo_pct: 3.5 },
      error: null,
    });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(chain({ data: null, error: null }));

    await POST(postReq({ evento_id: "ev-1", monto: 1000, metodo: "tarjeta", tipo_tarjeta: "VISA", num_cuotas: 3 }));
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ recargo_pct: 3.5 })
    );
  });

  it("returns 400 when evento_id is missing", async () => {
    const res = await POST(postReq({ monto: 500, metodo: "efectivo" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/evento_id/);
  });

  it("returns 400 when monto is 0 or missing", async () => {
    const res = await POST(postReq({ evento_id: "ev-1", monto: 0, metodo: "efectivo" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/monto/);
  });

  it("returns 400 when metodo is missing", async () => {
    const res = await POST(postReq({ evento_id: "ev-1", monto: 500 }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when evento is not found", async () => {
    mockFrom.mockReturnValueOnce(
      chain({ data: null, error: { message: "Not found", code: "PGRST116" } })
    );

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(404);
  });

  it("returns 400 on pago insert error", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: "Constraint" } }));

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest("http://localhost/api/pagos", {
      method: "POST",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });

  it("creates movimiento_caja ingreso after successful pago insert", async () => {
    const movimientoChain = chain({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: mockPago, error: null }))
      .mockReturnValueOnce(movimientoChain);

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(201);
    expect(movimientoChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "ingreso",
        categoria: "pago_evento",
        evento_id: "ev-1",
        monto: 1000, // montoFinal = body.monto when no discount
        pago_id: "pago-1", // exact FK link — enables reliable delete/update sync
        descripcion: "Pago evento (efectivo) — Mateo", // human-readable, no UUID
      })
    );
  });
});

// ── POST — recalculation consistency ─────────────────────────────────────────
//
// POST, PUT, and DELETE all route through recalcularEstadoEvento. These tests
// verify that POST wires the call correctly and that the return value drives
// the response — including states that the old inline logic could never produce.

describe("POST /api/pagos — recalculation", () => {
  const validBody = { evento_id: "ev-1", monto: 1000, metodo: "efectivo" };

  function setupMocks(pagoData = mockPago) {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: pagoData, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null })); // movimiento_caja
  }

  it("calls recalcularEstadoEvento with the correct eventoId and userId", async () => {
    setupMocks();

    await POST(postReq(validBody));

    expect(mockRecalcularEstadoEvento).toHaveBeenCalledTimes(1);
    expect(mockRecalcularEstadoEvento).toHaveBeenCalledWith(
      expect.anything(), // supabase client
      "ev-1",           // eventoId
      "user-1"          // userId
    );
  });

  it("sets confirmado on a second payment that reaches the seña threshold", async () => {
    // Old bug: inline logic required totalPagadoAntes === 0 to set "confirmado".
    // A second payment that pushed the total above the seña was silently ignored.
    // recalcularEstadoEvento re-evaluates from the full running total every time.
    mockRecalcularEstadoEvento.mockResolvedValue("confirmado");
    setupMocks();

    const res = await POST(postReq({ evento_id: "ev-1", monto: 300, metodo: "efectivo" }));
    expect(res.status).toBe(201);
    expect((await res.json()).evento_estado).toBe("confirmado");
  });

  it("evento_estado reflects all three possible recalc outcomes", async () => {
    for (const expected of ["pendiente", "confirmado", "completado"] as const) {
      jest.clearAllMocks();
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      mockRecalcularEstadoEvento.mockResolvedValue(expected);
      setupMocks();

      const res = await POST(postReq(validBody));
      expect((await res.json()).evento_estado).toBe(expected);
    }
  });
});

// ── POST — descuento validation ───────────────────────────────────────────────

describe("POST /api/pagos — descuentos", () => {
  const base = { evento_id: "ev-1", monto: 1000, metodo: "efectivo" };

  it("returns 400 when tiene_descuento but tipo_descuento is missing", async () => {
    const res = await POST(postReq({ ...base, tiene_descuento: true, valor_descuento: 10 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/tipo_descuento/);
  });

  it("returns 400 when tiene_descuento but tipo_descuento is invalid", async () => {
    const res = await POST(postReq({ ...base, tiene_descuento: true, tipo_descuento: "invalido", valor_descuento: 10 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/tipo_descuento/);
  });

  it("returns 400 when tiene_descuento but valor_descuento is missing", async () => {
    const res = await POST(postReq({ ...base, tiene_descuento: true, tipo_descuento: "porcentaje" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/valor_descuento/);
  });

  it("returns 400 when tiene_descuento but valor_descuento is 0", async () => {
    const res = await POST(postReq({ ...base, tiene_descuento: true, tipo_descuento: "monto", valor_descuento: 0 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/valor_descuento/);
  });

  it("returns 400 when porcentaje descuento > 100", async () => {
    const res = await POST(postReq({ ...base, tiene_descuento: true, tipo_descuento: "porcentaje", valor_descuento: 110 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/100/);
  });

  it("returns 400 when monto_final <= 0 after discount", async () => {
    // monto=1000, descuento monto=1000 → monto_final=0
    const res = await POST(postReq({ ...base, tiene_descuento: true, tipo_descuento: "monto", valor_descuento: 1000 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/monto_final/);
  });

  it("inserts pago with monto_final for porcentaje discount and uses it in movimiento_caja", async () => {
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

    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(movimientoChain);

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
    // monto=1000, fixed $200 → monto_final=800
    const insertChain = chain({ data: { ...mockPago, monto_final: 800 }, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(chain({ data: null, error: null })); // movimiento_caja

    const res = await POST(postReq({ ...base, tiene_descuento: true, tipo_descuento: "monto", valor_descuento: 200 }));
    expect(res.status).toBe(201);
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ monto_final: 800, tipo_descuento: "monto", valor_descuento: 200 })
    );
  });

  it("recalcularEstadoEvento determines status from monto_final (verified in pagos.test.ts)", async () => {
    // recalcularEstadoEvento reads monto_final ?? monto from the DB when called.
    // This integration is tested in src/lib/__tests__/pagos.test.ts.
    // Here we only verify the return value flows through to evento_estado.
    mockRecalcularEstadoEvento.mockResolvedValue("completado");
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: mockPago, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await POST(postReq({ evento_id: "ev-1", monto: 600, metodo: "efectivo" }));
    expect(res.status).toBe(201);
    expect((await res.json()).evento_estado).toBe("completado");
  });

  it("no descuento fields are stored when tiene_descuento is false", async () => {
    const insertChain = chain({ data: mockPago, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(insertChain)
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
    mockRecalcularEstadoEvento.mockResolvedValue("confirmado");
    const insertChain = chain({ data: { ...mockPago, quien_recibio: "Carlos" }, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(chain({ data: null, error: null })); // movimiento_caja

    const res = await POST(postReq({ ...base, quien_recibio: "Carlos" }));
    expect(res.status).toBe(201);
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ quien_recibio: "Carlos" })
    );
  });

  it("stores quien_recibio as null when not provided", async () => {
    const insertChain = chain({ data: mockPago, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(chain({ data: null, error: null }));

    await POST(postReq(base));
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ quien_recibio: null })
    );
  });
});

// ── POST — transferencia recargo ──────────────────────────────────────────────

describe("POST /api/pagos — transferencia recargo", () => {
  function setupMocks(pagoData = mockPago) {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: pagoData, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }));
  }

  it("stores recargo_pct from config for transferencia", async () => {
    const insertChain = chain({
      data: { ...mockPago, metodo: "transferencia", recargo_pct: 2.5 },
      error: null,
    });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await POST(
      postReq({ evento_id: "ev-1", monto: 1000, metodo: "transferencia" })
    );
    expect(res.status).toBe(201);
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ metodo: "transferencia", recargo_pct: 2.5 })
    );
  });

  it("stores recargo_pct = 0 for efectivo regardless of config", async () => {
    const insertChain = chain({ data: mockPago, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(chain({ data: null, error: null }));

    await POST(postReq({ evento_id: "ev-1", monto: 1000, metodo: "efectivo" }));
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ recargo_pct: 0 })
    );
  });

  it("stores 0 when config has no recargo_transferencia_pct", async () => {
    const configSinRecargo = { ...mockConfig, recargo_transferencia_pct: 0 };
    const insertChain = chain({ data: mockPago, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: configSinRecargo, error: null }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(chain({ data: null, error: null }));

    await POST(postReq({ evento_id: "ev-1", monto: 1000, metodo: "transferencia" }));
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ recargo_pct: 0 })
    );
  });

  it("tarjeta recargo is unaffected by recargo_transferencia_pct", async () => {
    const insertChain = chain({
      data: { ...mockPago, metodo: "tarjeta", recargo_pct: 3.5 },
      error: null,
    });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(chain({ data: null, error: null }));

    await POST(
      postReq({ evento_id: "ev-1", monto: 1000, metodo: "tarjeta", tipo_tarjeta: "VISA", num_cuotas: 3 })
    );
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ recargo_pct: 3.5 })
    );
  });

  it("monto_final remains null for transferencia with recargo only (no discount)", async () => {
    const insertChain = chain({ data: mockPago, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(chain({ data: null, error: null }));

    await POST(postReq({ evento_id: "ev-1", monto: 1000, metodo: "transferencia" }));
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ monto_final: null })
    );
  });
});

// ── POST — admin recargo override ─────────────────────────────────────────────

describe("POST /api/pagos — admin recargo override", () => {
  const { getUserRol } = jest.requireMock("@/lib/auth-helpers");

  it("non-admin sending recargo_pct receives 403", async () => {
    (getUserRol as jest.Mock).mockResolvedValueOnce("general");
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }));

    const res = await POST(
      postReq({ evento_id: "ev-1", monto: 1000, metodo: "efectivo", recargo_pct: 5 })
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/administrador/);
  });

  it("supervisor sending recargo_pct receives 403", async () => {
    (getUserRol as jest.Mock).mockResolvedValueOnce("supervisor");
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }));

    const res = await POST(
      postReq({ evento_id: "ev-1", monto: 1000, metodo: "transferencia", recargo_pct: 1 })
    );
    expect(res.status).toBe(403);
  });

  it("admin can override recargo_pct to a custom value", async () => {
    (getUserRol as jest.Mock).mockResolvedValueOnce("admin");
    const insertChain = chain({ data: { ...mockPago, recargo_pct: 7 }, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await POST(
      postReq({ evento_id: "ev-1", monto: 1000, metodo: "transferencia", recargo_pct: 7 })
    );
    expect(res.status).toBe(201);
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ recargo_pct: 7 })
    );
  });

  it("admin can set recargo_pct to 0 (waive surcharge)", async () => {
    (getUserRol as jest.Mock).mockResolvedValueOnce("admin");
    const insertChain = chain({ data: mockPago, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(chain({ data: null, error: null }));

    const res = await POST(
      postReq({ evento_id: "ev-1", monto: 1000, metodo: "transferencia", recargo_pct: 0 })
    );
    expect(res.status).toBe(201);
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ recargo_pct: 0 })
    );
  });

  it("admin sending negative recargo_pct receives 400", async () => {
    (getUserRol as jest.Mock).mockResolvedValueOnce("admin");
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }));

    const res = await POST(
      postReq({ evento_id: "ev-1", monto: 1000, metodo: "transferencia", recargo_pct: -1 })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/non-negative/);
  });

  it("omitting recargo_pct uses config value regardless of role", async () => {
    // Even when user is admin, not sending recargo_pct → config value is used
    (getUserRol as jest.Mock).mockResolvedValueOnce("admin");
    const insertChain = chain({ data: { ...mockPago, recargo_pct: 2.5 }, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(chain({ data: null, error: null }));

    await POST(postReq({ evento_id: "ev-1", monto: 1000, metodo: "transferencia" }));
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ recargo_pct: 2.5 })
    );
  });
});
