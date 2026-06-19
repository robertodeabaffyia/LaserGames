/**
 * @jest-environment node
 */
import { recalcularEstadoEvento } from "../pagos";

// ── helpers ───────────────────────────────────────────────────────────────────

const mockFrom = jest.fn();
const supabase = { from: mockFrom };

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "update", "eq", "single", "order"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

/** Set up the three mandatory reads + optional estado update. */
function mockRecalc({
  estado = "pendiente",
  precioTotal = 3000,
  pagos = [] as { monto: number; monto_final: number | null }[],
  montoSena = 0,
  expectUpdate = false,
  newEstado = "pendiente",
}: {
  estado?: string;
  precioTotal?: number;
  pagos?: { monto: number; monto_final: number | null }[];
  montoSena?: number;
  expectUpdate?: boolean;
  newEstado?: string;
}) {
  mockFrom
    .mockReturnValueOnce(
      chain({ data: { id: "ev-1", precio_total: precioTotal, estado }, error: null })
    )
    .mockReturnValueOnce(chain({ data: pagos, error: null }))
    .mockReturnValueOnce(
      chain({ data: { monto_seña: montoSena }, error: null })
    );

  if (expectUpdate) {
    const updateChain = chain({ data: null, error: null });
    mockFrom.mockReturnValueOnce(updateChain);
    return updateChain;
  }
  return null;
}

beforeEach(() => jest.clearAllMocks());

// ── recalcularEstadoEvento ────────────────────────────────────────────────────

describe("recalcularEstadoEvento", () => {
  it("sets completado when totalPagado >= precio_total", async () => {
    const updateChain = mockRecalc({
      estado: "pendiente",
      precioTotal: 3000,
      pagos: [{ monto: 3000, monto_final: null }],
      montoSena: 1000,
      expectUpdate: true,
      newEstado: "completado",
    });

    const result = await recalcularEstadoEvento(supabase, "ev-1", "user-1");

    expect(updateChain!.update).toHaveBeenCalledWith({ estado: "completado" });
    expect(result).toBe("completado");
  });

  it("sets confirmado when totalPagado >= montoSena but < precio_total", async () => {
    const updateChain = mockRecalc({
      estado: "pendiente",
      precioTotal: 3000,
      pagos: [{ monto: 1500, monto_final: null }],
      montoSena: 1000,
      expectUpdate: true,
      newEstado: "confirmado",
    });

    const result = await recalcularEstadoEvento(supabase, "ev-1", "user-1");

    expect(updateChain!.update).toHaveBeenCalledWith({ estado: "confirmado" });
    expect(result).toBe("confirmado");
  });

  it("sets pendiente when totalPagado < montoSena", async () => {
    const updateChain = mockRecalc({
      estado: "completado",
      precioTotal: 3000,
      pagos: [{ monto: 500, monto_final: null }],
      montoSena: 1000,
      expectUpdate: true,
      newEstado: "pendiente",
    });

    const result = await recalcularEstadoEvento(supabase, "ev-1", "user-1");

    expect(updateChain!.update).toHaveBeenCalledWith({ estado: "pendiente" });
    expect(result).toBe("pendiente");
  });

  it("sets pendiente when all payments are deleted (empty list)", async () => {
    const updateChain = mockRecalc({
      estado: "completado",
      precioTotal: 3000,
      pagos: [],
      montoSena: 1000,
      expectUpdate: true,
      newEstado: "pendiente",
    });

    const result = await recalcularEstadoEvento(supabase, "ev-1", "user-1");

    expect(updateChain!.update).toHaveBeenCalledWith({ estado: "pendiente" });
    expect(result).toBe("pendiente");
  });

  it("does NOT update when estado is already correct", async () => {
    mockRecalc({
      estado: "completado",
      precioTotal: 3000,
      pagos: [{ monto: 3000, monto_final: null }],
      montoSena: 1000,
      expectUpdate: false,
    });

    const result = await recalcularEstadoEvento(supabase, "ev-1", "user-1");

    // Only 3 from() calls (evento, pagos, config) — no 4th update call
    expect(mockFrom).toHaveBeenCalledTimes(3);
    expect(result).toBe("completado");
  });

  it("uses monto_final over monto when discount exists", async () => {
    const updateChain = mockRecalc({
      estado: "pendiente",
      precioTotal: 3000,
      pagos: [{ monto: 2000, monto_final: 1800 }], // 10% discount
      montoSena: 1000,
      expectUpdate: true,
      newEstado: "confirmado",
    });

    const result = await recalcularEstadoEvento(supabase, "ev-1", "user-1");

    // 1800 >= 1000 (seña) but < 3000 → confirmado
    expect(updateChain!.update).toHaveBeenCalledWith({ estado: "confirmado" });
    expect(result).toBe("confirmado");
  });

  it("treats missing seña config (0) as no-seña threshold", async () => {
    const updateChain = mockRecalc({
      estado: "completado",
      precioTotal: 3000,
      pagos: [{ monto: 500, monto_final: null }],
      montoSena: 0, // no seña configured
      expectUpdate: true,
      newEstado: "pendiente",
    });

    const result = await recalcularEstadoEvento(supabase, "ev-1", "user-1");

    // 500 < 3000 and no seña → pendiente (not confirmado)
    expect(updateChain!.update).toHaveBeenCalledWith({ estado: "pendiente" });
    expect(result).toBe("pendiente");
  });

  it("returns pendiente when evento not found", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { message: "not found" } }));

    await expect(
      recalcularEstadoEvento(supabase, "missing", "user-1")
    ).resolves.toBe("pendiente");
  });
});
