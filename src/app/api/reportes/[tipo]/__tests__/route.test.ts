/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";

jest.useFakeTimers();
jest.setSystemTime(new Date("2026-05-21T12:00:00Z"));

const mockFrom = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({ from: mockFrom })
  ),
}));

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of [
    "select", "insert", "update", "delete", "eq", "gte", "lte",
    "order", "single", "not", "filter", "in", "limit",
  ]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

function req(tipo: string, qs = "") {
  return new NextRequest(`http://localhost/api/reportes/${tipo}${qs ? `?${qs}` : ""}`);
}

function params(tipo: string) {
  return { params: Promise.resolve({ tipo }) };
}

beforeEach(() => jest.clearAllMocks());

// ── invalid tipo ───────────────────────────────────────────────────────────────

describe("GET /api/reportes/[tipo] — invalid", () => {
  it("returns 400 for unknown tipo", async () => {
    const res = await GET(req("desconocido"), params("desconocido"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Tipo inválido/);
  });
});

// ── kpis ───────────────────────────────────────────────────────────────────────

describe("GET /api/reportes/kpis", () => {
  const movimientos = [
    { tipo: "ingreso", monto: 3000 },
    { tipo: "ingreso", monto: 1500 },
    { tipo: "egreso", monto: 800 },
  ];
  const clientes = [
    { fecha_cumpleanos: "1990-05-25" }, // in 4 days — within 30
    { fecha_cumpleanos: "1985-07-10" }, // not within 30
  ];
  const hijos = [{ fecha_cumpleanos: "2018-05-30" }]; // 9 days — within 30

  it("returns correct KPI totals", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: movimientos, error: null }))        // movimientos_caja
      .mockReturnValueOnce(chain({ data: null, error: null, count: 5 }))     // eventos count
      .mockReturnValueOnce(chain({ data: [{ id: "ev-1" }, { id: "ev-2" }], error: null })) // pendientes
      .mockReturnValueOnce(chain({ data: clientes, error: null }))            // clientes
      .mockReturnValueOnce(chain({ data: hijos, error: null }));              // hijos

    const res = await GET(req("kpis"), params("kpis"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ingresos_mes).toBe(4500);
    expect(body.egresos_mes).toBe(800);
    expect(body.ganancia_neta).toBe(3700);
    expect(body.eventos_mes).toBe(5);
    expect(body.pagos_pendientes).toBe(2);
    expect(body.cumpleanos_proximos).toBe(2); // 1990-05-25 and 2018-05-30
  });

  it("returns 500 on movimientos DB error", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { message: "DB fail" } }));

    const res = await GET(req("kpis"), params("kpis"));
    expect(res.status).toBe(500);
  });

  it("handles empty data gracefully", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null, count: 0 }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }));

    const res = await GET(req("kpis"), params("kpis"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ingresos_mes).toBe(0);
    expect(body.ganancia_neta).toBe(0);
    expect(body.cumpleanos_proximos).toBe(0);
  });
});

// ── resumen ────────────────────────────────────────────────────────────────────

describe("GET /api/reportes/resumen", () => {
  const movimientos = [
    { tipo: "ingreso", monto: 2000, fecha: "2026-05-01" },
    { tipo: "egreso",  monto: 500,  fecha: "2026-05-01" },
    { tipo: "ingreso", monto: 1000, fecha: "2026-05-15" },
  ];

  it("aggregates totals and por_dia correctly", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: movimientos, error: null }));

    const res = await GET(req("resumen", "desde=2026-05-01&hasta=2026-05-31"), params("resumen"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total_ingresos).toBe(3000);
    expect(body.total_egresos).toBe(500);
    expect(body.ganancia_neta).toBe(2500);
    expect(body.por_dia).toHaveLength(2);
    const dia1 = body.por_dia.find((d: { fecha: string }) => d.fecha === "2026-05-01");
    expect(dia1.ingresos).toBe(2000);
    expect(dia1.egresos).toBe(500);
  });

  it("defaults to current month when no date params", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValueOnce(c);
    await GET(req("resumen"), params("resumen"));
    expect(c.gte).toHaveBeenCalledWith("fecha", "2026-05-01");
    expect(c.lte).toHaveBeenCalledWith("fecha", "2026-05-31");
  });

  it("returns 500 on DB error", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { message: "DB fail" } }));
    const res = await GET(req("resumen"), params("resumen"));
    expect(res.status).toBe(500);
  });
});

// ── eventos ────────────────────────────────────────────────────────────────────

describe("GET /api/reportes/eventos", () => {
  const eventos = [
    { id: "e1", estado: "completado", precio_total: 3000, paquete_id: "p1", paquete: { id: "p1", nombre: "Básico" } },
    { id: "e2", estado: "completado", precio_total: 4000, paquete_id: "p2", paquete: { id: "p2", nombre: "Premium" } },
    { id: "e3", estado: "confirmado", precio_total: 3000, paquete_id: "p1", paquete: { id: "p1", nombre: "Básico" } },
  ];

  it("returns correct stats", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: eventos, error: null }));

    const res = await GET(req("eventos", "desde=2026-05-01&hasta=2026-05-31"), params("eventos"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total_eventos).toBe(3);
    expect(body.total_ingresos).toBe(7000); // only completados
    expect(body.paquete_mas_vendido).toBe("Básico"); // 2 vs 1
    expect(body.por_paquete).toHaveLength(2);
    expect(body.por_estado).toHaveLength(2);
  });

  it("returns 500 on DB error", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { message: "fail" } }));
    const res = await GET(req("eventos"), params("eventos"));
    expect(res.status).toBe(500);
  });
});

// ── clientes ───────────────────────────────────────────────────────────────────

describe("GET /api/reportes/clientes", () => {
  const eventos = [
    { cliente_id: "c1", fecha_evento: "2026-01-10T10:00:00", precio_total: 2000, estado: "completado", cliente: { id: "c1", nombre: "Ana" } },
    { cliente_id: "c1", fecha_evento: "2026-04-05T10:00:00", precio_total: 2500, estado: "completado", cliente: { id: "c1", nombre: "Ana" } },
    { cliente_id: "c2", fecha_evento: "2026-03-15T10:00:00", precio_total: 1800, estado: "completado", cliente: { id: "c2", nombre: "Luis" } },
    { cliente_id: "c1", fecha_evento: "2026-12-01T10:00:00", precio_total: 3000, estado: "confirmado", cliente: { id: "c1", nombre: "Ana" } },
  ];

  it("returns ranking sorted by total_eventos", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: eventos, error: null }));

    const res = await GET(req("clientes", "desde=2026-01-01&hasta=2026-12-31"), params("clientes"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ranking[0].nombre).toBe("Ana");
    expect(body.ranking[0].total_eventos).toBe(3);
    expect(body.ranking[0].total_gastado).toBe(4500); // 2000+2500, not counting confirmado
    expect(body.ranking[1].nombre).toBe("Luis");
  });

  it("returns 500 on DB error", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { message: "fail" } }));
    const res = await GET(req("clientes"), params("clientes"));
    expect(res.status).toBe(500);
  });
});

// ── empleados ──────────────────────────────────────────────────────────────────

describe("GET /api/reportes/empleados", () => {
  const registros = [
    { empleado_id: "emp-1", horas_trabajadas: 40, empleado: { id: "emp-1", nombre: "Carlos", tarifa_horaria: 100 } },
    { empleado_id: "emp-1", horas_trabajadas: 8,  empleado: { id: "emp-1", nombre: "Carlos", tarifa_horaria: 100 } },
    { empleado_id: "emp-2", horas_trabajadas: 30, empleado: { id: "emp-2", nombre: "Diana",  tarifa_horaria: 80  } },
  ];
  const bonos = [{ empleado_id: "emp-1", monto_bono: 300 }];

  it("returns correct employee stats", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: registros, error: null }))
      .mockReturnValueOnce(chain({ data: bonos, error: null }));

    const res = await GET(req("empleados", "desde=2026-05-01&hasta=2026-05-31"), params("empleados"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total_horas).toBe(78);
    expect(body.top_empleado).toBe("Carlos");
    const carlos = body.resumen.find((e: { nombre: string }) => e.nombre === "Carlos");
    expect(carlos.horas_trabajadas).toBe(48);
    expect(carlos.salario_total).toBe(4800);
    expect(carlos.bonos_total).toBe(300);
    expect(carlos.total_costo).toBe(5100);
  });

  it("returns 500 on registros DB error", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { message: "fail" } }));
    const res = await GET(req("empleados"), params("empleados"));
    expect(res.status).toBe(500);
  });
});

// ── movimientos ────────────────────────────────────────────────────────────────

describe("GET /api/reportes/movimientos", () => {
  const movimientos = [
    { tipo: "ingreso", categoria: "pago_evento", monto: 3000 },
    { tipo: "ingreso", categoria: "pago_evento", monto: 1500 },
    { tipo: "egreso",  categoria: "salario",     monto: 2000 },
    { tipo: "egreso",  categoria: "compras",     monto: 400  },
  ];

  it("returns correct breakdown by categoria", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: movimientos, error: null }));

    const res = await GET(req("movimientos", "desde=2026-05-01&hasta=2026-05-31"), params("movimientos"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total_ingresos).toBe(4500);
    expect(body.total_egresos).toBe(2400);
    expect(body.ganancia_neta).toBe(2100);
    expect(body.por_categoria).toHaveLength(3);
    const pagoEvento = body.por_categoria.find((c: { categoria: string }) => c.categoria === "pago_evento");
    expect(pagoEvento.total).toBe(4500);
  });

  it("returns 500 on DB error", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { message: "fail" } }));
    const res = await GET(req("movimientos"), params("movimientos"));
    expect(res.status).toBe(500);
  });
});
