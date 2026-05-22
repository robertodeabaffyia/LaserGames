/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

const mockFrom = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

const mockEnviarEmail    = jest.fn();
const mockEnviarWhatsApp = jest.fn();
jest.mock("@/lib/notificaciones", () => ({
  renderTemplate:   jest.fn((t: string, v: Record<string, string>) =>
    t.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => v[k] ?? `{{${k}}}`)),
  enviarEmail:      (...args: unknown[]) => mockEnviarEmail(...args),
  enviarWhatsApp:   (...args: unknown[]) => mockEnviarWhatsApp(...args),
}));

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of [
    "select", "insert", "eq", "gte", "lte", "order", "single", "limit",
  ]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const mockConfig = {
  id: "cfg-3",
  tipo: "confirmacion_evento",
  habilitada: true,
  canal: "email",
  dias_anticipacion: 0,
  descripcion: "Confirmación de evento",
  contenido_template: "Hola {{nombre_cliente}}, tu evento de {{nombre_festejado}} está confirmado.",
};

const mockEvento = {
  id: "ev-1",
  nombre_festejado: "Pepito",
  fecha_evento: "2026-06-15T16:00:00",
  precio_total: 5000,
  cliente: { id: "cli-1", nombre: "Ana García", email: "ana@test.com", telefono: null },
};

function cronReq(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/cron/confirmacion-evento", {
    method: "POST",
    headers,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.CRON_SECRET;
  mockEnviarEmail.mockResolvedValue({ ok: true });
  mockEnviarWhatsApp.mockResolvedValue({ ok: true });
});

describe("POST /api/cron/confirmacion-evento", () => {
  it("returns 401 when CRON_SECRET is set and header missing", async () => {
    process.env.CRON_SECRET = "secret";
    const res = await POST(cronReq());
    expect(res.status).toBe(401);
  });

  it("returns 0 enviados when config is disabled", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Not found" } }));
    const res = await POST(cronReq());
    expect(res.status).toBe(200);
    expect((await res.json()).enviados).toBe(0);
  });

  it("returns 0 enviados when no confirmado events", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }));
    const res = await POST(cronReq());
    expect(res.status).toBe(200);
    expect((await res.json()).enviados).toBe(0);
  });

  it("sends email for unnotified confirmed event and logs historial", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))           // config
      .mockReturnValueOnce(chain({ data: [mockEvento], error: null }))         // eventos confirmados
      .mockReturnValueOnce(chain({ data: [], error: null }))                   // ya notificado
      .mockReturnValueOnce(chain({ data: null, error: null }))                 // desuscripciones
      .mockReturnValueOnce(chain({ data: [{ monto: 2000 }], error: null }))   // pagos
      .mockReturnValueOnce(chain({ data: null, error: null }));                // insert historial

    const res = await POST(cronReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enviados).toBe(1);
    expect(mockEnviarEmail).toHaveBeenCalledWith(
      "ana@test.com",
      mockConfig.descripcion,
      expect.stringContaining("Ana García")
    );
  });

  it("skips event already in historial", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: [mockEvento], error: null }))
      .mockReturnValueOnce(chain({ data: [{ id: "h-1" }], error: null })); // already notified

    const res = await POST(cronReq());
    expect(res.status).toBe(200);
    expect((await res.json()).enviados).toBe(0);
    expect(mockEnviarEmail).not.toHaveBeenCalled();
  });

  it("returns 500 on eventos DB error", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: "DB error" } }));
    const res = await POST(cronReq());
    expect(res.status).toBe(500);
  });
});
