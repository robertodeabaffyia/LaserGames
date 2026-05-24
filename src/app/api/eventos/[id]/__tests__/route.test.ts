/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, PUT, DELETE } from "../route";

const mockFrom = jest.fn();
const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      from: mockFrom,
      auth: { getUser: mockGetUser },
    })
  ),
}));

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "insert", "update", "delete", "eq", "not", "order", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const ID = "ev-1";
const params = { params: Promise.resolve({ id: ID }) };

function req(method: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/eventos/${ID}`, {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

const mockEvento = {
  id: ID,
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
  paquete: {
    precio: 3000,
    duracion_horas: 2,
    duracion_minutos: 0,
    cantidad_ninos_incluidos: 5,
    cantidad_adultos_incluidos: 2,
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("GET /api/eventos/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(req("GET"), params);
    expect(res.status).toBe(401);
  });

  it("returns 200 with evento and relations", async () => {
    mockFrom.mockReturnValue(chain({ data: mockEvento, error: null }));

    const res = await GET(req("GET"), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nombre_festejado).toBe("Mateo");
  });

  it("returns 404 when not found", async () => {
    mockFrom.mockReturnValue(
      chain({ data: null, error: { message: "Not found", code: "PGRST116" } })
    );

    const res = await GET(req("GET"), params);
    expect(res.status).toBe(404);
  });

  it("returns 500 on general DB error", async () => {
    mockFrom.mockReturnValue(
      chain({ data: null, error: { message: "Connection failed", code: "500" } })
    );

    const res = await GET(req("GET"), params);
    expect(res.status).toBe(500);
  });
});

describe("PUT /api/eventos/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await PUT(req("PUT", { nombre_festejado: "Test" }), params);
    expect(res.status).toBe(401);
  });

  it("returns 200 with updated evento", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null })) // fetch current
      .mockReturnValueOnce(chain({ data: { ...mockEvento, nombre_festejado: "Leo" }, error: null })); // update

    const res = await PUT(req("PUT", { nombre_festejado: "Leo" }), params);
    expect(res.status).toBe(200);
    expect((await res.json()).nombre_festejado).toBe("Leo");
  });

  it("returns 404 when current evento is not found", async () => {
    mockFrom.mockReturnValueOnce(
      chain({ data: null, error: { message: "Not found", code: "PGRST116" } })
    );

    const res = await PUT(req("PUT", { notas: "Test" }), params);
    expect(res.status).toBe(404);
  });

  it("recalculates precio_total when descuento changes", async () => {
    const updateChain = chain({ data: { ...mockEvento, descuento: 500, precio_total: 2500 }, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null })) // fetch current
      .mockReturnValueOnce(updateChain);                              // update

    const res = await PUT(req("PUT", { descuento: 500 }), params);
    expect(res.status).toBe(200);
    // precio_total = 3000 (base) + 0 extras - 500 discount = 2500
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ precio_total: 2500 })
    );
  });

  it("returns 409 when rescheduled event overlaps another", async () => {
    const conflicting = [
      { id: "other-ev", fecha_evento: "2026-06-20T13:00:00Z", duracion_horas: 2, duracion_minutos: 0 },
    ];
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))     // fetch current
      .mockReturnValueOnce(chain({ data: conflicting, error: null }));   // overlap check

    const res = await PUT(req("PUT", { fecha_evento: "2026-06-20T14:00:00Z" }), params);
    expect(res.status).toBe(409);
  });

  it("allows reschedule when only overlap is self", async () => {
    // Self-overlap should be excluded
    const selfSlot = [{ id: ID, fecha_evento: "2026-06-20T14:00:00Z", duracion_horas: 2, duracion_minutos: 0 }];
    const updateChain = chain({ data: { ...mockEvento, fecha_evento: "2026-06-20T14:00:00Z" }, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))  // fetch current
      .mockReturnValueOnce(chain({ data: selfSlot, error: null }))    // overlap check
      .mockReturnValueOnce(updateChain);                               // update

    const res = await PUT(req("PUT", { fecha_evento: "2026-06-20T14:00:00Z" }), params);
    expect(res.status).toBe(200);
  });

  it("returns 403 when non-admin tries to set completado", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "staff" }, error: null })); // usuarios

    const res = await PUT(req("PUT", { estado: "completado" }), params);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/administrador/);
  });

  it("returns 403 when non-admin tries to set cancelado", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "staff" }, error: null })); // usuarios

    const res = await PUT(req("PUT", { estado: "cancelado" }), params);
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated user tries to set completado", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await PUT(req("PUT", { estado: "completado" }), params);
    expect(res.status).toBe(401);
  });

  it("allows admin to set completado", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    const updateChain = chain({ data: { ...mockEvento, estado: "completado" }, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null })) // usuarios
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))        // fetch current
      .mockReturnValueOnce(updateChain);                                     // update

    const res = await PUT(req("PUT", { estado: "completado" }), params);
    expect(res.status).toBe(200);
    expect((await res.json()).estado).toBe("completado");
  });

  it("allows admin to set cancelado", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    const updateChain = chain({ data: { ...mockEvento, estado: "cancelado" }, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null })) // usuarios
      .mockReturnValueOnce(chain({ data: mockEvento, error: null }))        // fetch current
      .mockReturnValueOnce(updateChain);                                     // update

    const res = await PUT(req("PUT", { estado: "cancelado" }), params);
    expect(res.status).toBe(200);
    expect((await res.json()).estado).toBe("cancelado");
  });

  it("allows any user to set confirmado (not admin-only)", async () => {
    const updateChain = chain({ data: { ...mockEvento, estado: "confirmado" }, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null })) // fetch current
      .mockReturnValueOnce(updateChain);                              // update

    const res = await PUT(req("PUT", { estado: "confirmado" }), params);
    expect(res.status).toBe(200);
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest(`http://localhost/api/eventos/${ID}`, {
      method: "PUT",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(badReq, params);
    expect(res.status).toBe(400);
  });

  it("returns 400 on DB update error", async () => {
    const updateChain = chain({ data: null, error: { message: "Constraint", code: "23000" } });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockEvento, error: null })) // fetch current
      .mockReturnValueOnce(updateChain);                              // update fails

    const res = await PUT(req("PUT", { notas: "x" }), params);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/eventos/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(401);
  });

  it("returns 204 on success", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(204);
    expect(mockFrom).toHaveBeenCalledWith("eventos");
  });

  it("returns 400 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "FK constraint" } }));

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(400);
  });
});
