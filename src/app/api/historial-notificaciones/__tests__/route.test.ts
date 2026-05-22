/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "../route";

const mockFrom = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "eq", "gte", "lte", "order", "limit"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const mockHistorial = {
  id: "h-1",
  tipo_notificacion: "evento_recordatorio",
  entidad_id: "ev-1",
  destinatario: "test@test.com",
  canal: "email",
  contenido_enviado: "Hola Ana",
  status: "enviado",
  error_detalle: null,
  fecha_envio: "2026-05-21T10:00:00Z",
};

beforeEach(() => jest.clearAllMocks());

describe("GET /api/historial-notificaciones", () => {
  it("returns 200 with list", async () => {
    mockFrom.mockReturnValue(chain({ data: [mockHistorial], error: null }));
    const res = await GET(new NextRequest("http://localhost/api/historial-notificaciones"));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });

  it("filters by tipo", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);
    await GET(new NextRequest("http://localhost/api/historial-notificaciones?tipo=evento_recordatorio"));
    expect(c.eq).toHaveBeenCalledWith("tipo_notificacion", "evento_recordatorio");
  });

  it("filters by status", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);
    await GET(new NextRequest("http://localhost/api/historial-notificaciones?status=fallido"));
    expect(c.eq).toHaveBeenCalledWith("status", "fallido");
  });

  it("filters by date range", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);
    await GET(new NextRequest("http://localhost/api/historial-notificaciones?desde=2026-05-01&hasta=2026-05-31"));
    expect(c.gte).toHaveBeenCalledWith("fecha_envio", "2026-05-01");
    expect(c.lte).toHaveBeenCalledWith("fecha_envio", "2026-05-31");
  });

  it("returns 500 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "DB error" } }));
    const res = await GET(new NextRequest("http://localhost/api/historial-notificaciones"));
    expect(res.status).toBe(500);
  });
});
