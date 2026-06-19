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
  for (const m of ["select", "insert", "update", "delete", "eq", "gte", "lte", "not", "order", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const mockPaquete = {
  precio: 3000,
  duracion_horas: 2,
  duracion_minutos: 0,
  cantidad_ninos_incluidos: 5,
  cantidad_adultos_incluidos: 2,
};
const mockEvento = {
  id: "ev-1",
  cliente_id: "cli-1",
  paquete_id: "paq-1",
  fecha_evento: "2026-06-15T14:00:00Z",
  nombre_festejado: "Mateo",
  duracion_horas: 2,
  duracion_minutos: 0,
  cantidad_ninos_totales: 0,
  cantidad_adultos_totales: 0,
  precio_nino_extra: 0,
  precio_adulto: 0,
  descuento: 0,
  precio_total: 3000,
  estado: "pendiente",
  notas: null,
};

function req(method: string, url: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("GET /api/eventos", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(req("GET", "http://localhost/api/eventos"));
    expect(res.status).toBe(401);
  });

  it("returns list of events", async () => {
    mockFrom.mockReturnValue(chain({ data: [mockEvento], error: null }));

    const res = await GET(req("GET", "http://localhost/api/eventos"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].nombre_festejado).toBe("Mateo");
  });

  it("returns 500 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "DB error" } }));

    const res = await GET(req("GET", "http://localhost/api/eventos"));
    expect(res.status).toBe(500);
  });

  it("passes estado filter to query", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(req("GET", "http://localhost/api/eventos?estado=confirmado"));
    expect(c.eq).toHaveBeenCalledWith("estado", "confirmado");
  });

  it("passes cliente_id filter to query", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(req("GET", "http://localhost/api/eventos?cliente_id=cli-1"));
    expect(c.eq).toHaveBeenCalledWith("cliente_id", "cli-1");
  });

  it("includes pagos in the response for saldo computation", async () => {
    const eventoWithPagos = {
      ...mockEvento,
      pagos: [
        { id: "p-1", monto: 1000, monto_final: null, metodo: "efectivo", fecha_pago: "2026-06-01T10:00:00Z" },
        { id: "p-2", monto: 500, monto_final: 450, metodo: "tarjeta", fecha_pago: "2026-06-05T10:00:00Z" },
      ],
    };
    mockFrom.mockReturnValue(chain({ data: [eventoWithPagos], error: null }));

    const res = await GET(req("GET", "http://localhost/api/eventos"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].pagos).toHaveLength(2);
    expect(body[0].pagos[1].monto_final).toBe(450);
  });

  it("passes fecha_inicio and fecha_fin filters", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(
      req("GET", "http://localhost/api/eventos?fecha_inicio=2026-06-01&fecha_fin=2026-06-30")
    );
    expect(c.gte).toHaveBeenCalledWith("fecha_evento", "2026-06-01");
    expect(c.lte).toHaveBeenCalledWith("fecha_evento", "2026-06-30");
  });
});

describe("POST /api/eventos", () => {
  const validBody = {
    cliente_id: "cli-1",
    paquete_id: "paq-1",
    fecha_evento: "2026-06-15T14:00:00Z",
    nombre_festejado: "Mateo",
  };

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req("POST", "http://localhost/api/eventos", validBody));
    expect(res.status).toBe(401);
  });

  it("returns 201 with created evento and correct price_total", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockPaquete, error: null }))   // paquetes fetch
      .mockReturnValueOnce(chain({ data: [], error: null }))             // overlap check
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }));    // insert

    const res = await POST(req("POST", "http://localhost/api/eventos", validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.nombre_festejado).toBe("Mateo");
    expect(mockFrom).toHaveBeenCalledWith("paquetes");
    expect(mockFrom).toHaveBeenCalledWith("eventos");
  });

  it("inserts with default estado=pendiente when not provided", async () => {
    const insertChain = chain({ data: mockEvento, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockPaquete, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain);

    await POST(req("POST", "http://localhost/api/eventos", validBody));
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ estado: "pendiente" })
    );
  });

  it("calculates precio_total with extras and discount", async () => {
    const bodyWithExtras = {
      ...validBody,
      cantidad_ninos_totales: 8,  // 8 - 5 included = 3 extra x 100 = 300
      precio_nino_extra: 100,
      cantidad_adultos_totales: 4, // 4 - 2 included = 2 extra x 150 = 300
      precio_adulto: 150,
      descuento: 200,
    };
    // Expected: 3000 + 300 + 300 - 200 = 3400
    const insertChain = chain({ data: { ...mockEvento, precio_total: 3400 }, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockPaquete, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain);

    const res = await POST(req("POST", "http://localhost/api/eventos", bodyWithExtras));
    expect(res.status).toBe(201);
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ precio_total: 3400 })
    );
  });

  it("returns 400 when cliente_id is missing", async () => {
    const res = await POST(
      req("POST", "http://localhost/api/eventos", {
        paquete_id: "paq-1",
        fecha_evento: "2026-06-15T14:00:00Z",
        nombre_festejado: "Mateo",
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/cliente_id/);
  });

  it("returns 400 when paquete_id is missing", async () => {
    const res = await POST(
      req("POST", "http://localhost/api/eventos", {
        cliente_id: "cli-1",
        fecha_evento: "2026-06-15T14:00:00Z",
        nombre_festejado: "Mateo",
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/paquete_id/);
  });

  it("returns 400 when fecha_evento is missing", async () => {
    const res = await POST(
      req("POST", "http://localhost/api/eventos", {
        cliente_id: "cli-1",
        paquete_id: "paq-1",
        nombre_festejado: "Mateo",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when nombre_festejado is missing", async () => {
    const res = await POST(
      req("POST", "http://localhost/api/eventos", {
        cliente_id: "cli-1",
        paquete_id: "paq-1",
        fecha_evento: "2026-06-15T14:00:00Z",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when paquete is not found", async () => {
    mockFrom.mockReturnValueOnce(
      chain({ data: null, error: { message: "Not found", code: "PGRST116" } })
    );

    const res = await POST(req("POST", "http://localhost/api/eventos", validBody));
    expect(res.status).toBe(404);
  });

  it("returns 409 when schedule overlaps an existing event", async () => {
    const conflicting = [
      { id: "ev-x", fecha_evento: "2026-06-15T13:00:00Z", duracion_horas: 2, duracion_minutos: 0 },
    ];
    mockFrom
      .mockReturnValueOnce(chain({ data: mockPaquete, error: null }))
      .mockReturnValueOnce(chain({ data: conflicting, error: null }));

    const res = await POST(req("POST", "http://localhost/api/eventos", validBody));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/traslapa/);
  });

  it("returns 400 on DB insert error", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockPaquete, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: "FK violation" } }));

    const res = await POST(req("POST", "http://localhost/api/eventos", validBody));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest("http://localhost/api/eventos", {
      method: "POST",
      body: "bad-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });

  it("copies duracion_horas=2 and duracion_minutos=30 from a 2h30m paquete", async () => {
    const paquete2h30 = { ...mockPaquete, duracion_horas: 2, duracion_minutos: 30 };
    const insertChain = chain({ data: { ...mockEvento, duracion_horas: 2, duracion_minutos: 30 }, error: null });

    mockFrom
      .mockReturnValueOnce(chain({ data: paquete2h30, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain);

    const res = await POST(req("POST", "http://localhost/api/eventos", validBody));

    expect(res.status).toBe(201);
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ duracion_horas: 2, duracion_minutos: 30 })
    );
  });
});
