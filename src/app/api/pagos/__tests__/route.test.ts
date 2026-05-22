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
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))         // fetch evento
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))          // fetch config
      .mockReturnValueOnce(chain({ data: [], error: null }))                  // existing pagos
      .mockReturnValueOnce(chain({ data: mockPago, error: null }))            // insert pago
      .mockReturnValueOnce(chain({ data: null, error: null }))                // update evento (confirmado)
      .mockReturnValueOnce(chain({ data: null, error: null }));               // insert movimiento_caja

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.monto).toBe(1000);
    expect(body.evento_estado).toBe("confirmado"); // first payment >= seña
  });

  it("sets evento to completado when fully paid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const existingPagos = [{ monto: 2000 }]; // already paid 2000 of 3000
    const updateChain = chain({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))          // fetch evento
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))           // fetch config
      .mockReturnValueOnce(chain({ data: existingPagos, error: null }))       // existing pagos
      .mockReturnValueOnce(chain({ data: { ...mockPago, monto: 1000 }, error: null })) // insert
      .mockReturnValueOnce(updateChain)                                         // update evento
      .mockReturnValueOnce(chain({ data: null, error: null }));                // insert movimiento_caja

    const res = await POST(postReq({ evento_id: "ev-1", monto: 1000, metodo: "efectivo" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.evento_estado).toBe("completado"); // 2000 + 1000 >= 3000
  });

  it("does not change estado when partial payment and no seña config", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const configNoSeña = { monto_seña: 0, tarjeta_recargos: {} };
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: configNoSeña, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: mockPago, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }));  // insert movimiento_caja
    // No update call expected (monto_seña = 0 disables seña logic)

    const res = await POST(postReq({ evento_id: "ev-1", monto: 500, metodo: "efectivo" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.evento_estado).toBe("pendiente"); // unchanged
  });

  it("calculates recargo_pct for tarjeta payment", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const insertChain = chain({ data: { ...mockPago, metodo: "tarjeta", tipo_tarjeta: "VISA", num_cuotas: 3, recargo_pct: 3.5 }, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(chain({ data: null, error: null }))  // update evento
      .mockReturnValueOnce(chain({ data: null, error: null })); // insert movimiento_caja

    await POST(postReq({ evento_id: "ev-1", monto: 1000, metodo: "tarjeta", tipo_tarjeta: "VISA", num_cuotas: 3 }));

    // Verify insert was called with recargo_pct 3.5 (from VISA 3-cuotas in config)
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
      .mockReturnValueOnce(chain({ data: null, error: null }))   // update evento
      .mockReturnValueOnce(movimientoChain);                     // movimiento_caja insert

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(201);
    expect(movimientoChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "ingreso",
        categoria: "pago_evento",
        evento_id: "ev-1",
        monto: 1000,
      })
    );
  });
});
