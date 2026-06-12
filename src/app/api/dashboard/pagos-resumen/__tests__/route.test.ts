/**
 * @jest-environment node
 */
import { GET } from "../route";

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
  for (const m of ["select", "in", "order"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/dashboard/pagos-resumen", () => {
  it("returns totales and eventos list", async () => {
    const eventos = [
      { id: "ev-1", nombre_festejado: "Mateo", fecha_evento: "2026-06-15T14:00:00Z",
        estado: "confirmado", precio_total: 3000, pagos: [{ monto: 1000 }, { monto: 500 }] },
      { id: "ev-2", nombre_festejado: "Luna", fecha_evento: "2026-07-01T10:00:00Z",
        estado: "pendiente", precio_total: 2500, pagos: [] },
    ];
    mockFrom.mockReturnValue(chain({ data: eventos, error: null }));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    // ev-1: pagado=1500, pendiente=1500
    // ev-2: pagado=0, pendiente=2500
    expect(body.totales.total_eventos).toBe(2);
    expect(body.totales.total_precio).toBe(5500);
    expect(body.totales.total_pagado).toBe(1500);
    expect(body.totales.total_pendiente).toBe(4000);
    expect(body.eventos).toHaveLength(2);
    expect(body.eventos[0].total_pagado).toBe(1500);
    expect(body.eventos[0].saldo_pendiente).toBe(1500);
    expect(body.eventos[1].total_pagado).toBe(0);
    expect(body.eventos[1].saldo_pendiente).toBe(2500);
  });

  it("filters only active estados", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET();
    expect(c.in).toHaveBeenCalledWith(
      "estado",
      ["pendiente", "cotizacion", "confirmado", "en_curso"]
    );
  });

  it("returns empty totales when no active eventos", async () => {
    mockFrom.mockReturnValue(chain({ data: [], error: null }));

    const res = await GET();
    const body = await res.json();
    expect(body.totales.total_eventos).toBe(0);
    expect(body.totales.total_pagado).toBe(0);
    expect(body.totales.total_pendiente).toBe(0);
  });

  it("returns 500 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "DB error" } }));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
