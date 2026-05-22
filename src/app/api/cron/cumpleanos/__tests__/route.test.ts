/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

jest.useFakeTimers();
jest.setSystemTime(new Date("2026-05-21T12:00:00Z"));

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
  id: "cfg-2",
  tipo: "promocion_cumpleanos",
  habilitada: true,
  canal: "email",
  dias_anticipacion: 7,
  descripcion: "Promo cumpleaños",
  contenido_template: "Hola {{nombre_cliente}}, cumple {{nombre_hijo}}",
};

// Client with a hijo whose birthday is 2026-05-28 (7 days after 2026-05-21)
const mockCliente = {
  id: "cli-1",
  nombre: "Ana García",
  email: "ana@test.com",
  telefono: "+5491112345678",
  fecha_cumpleanos: null,
  hijos: [{ id: "hijo-1", nombre: "Sofía", fecha_nacimiento: "2020-05-28" }],
};

function cronReq(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/cron/cumpleanos", {
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

describe("POST /api/cron/cumpleanos", () => {
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

  it("returns 0 enviados when no matching birthdays", async () => {
    const clienteNoMatch = { ...mockCliente, hijos: [{ id: "h-1", nombre: "X", fecha_nacimiento: "2020-01-01" }] };
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: [clienteNoMatch], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null })); // desuscripciones

    const res = await POST(cronReq());
    expect(res.status).toBe(200);
    expect((await res.json()).enviados).toBe(0);
  });

  it("sends email for matching birthday and logs historial", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))     // config
      .mockReturnValueOnce(chain({ data: [mockCliente], error: null }))  // clientes
      .mockReturnValueOnce(chain({ data: null, error: null }))            // desuscripciones
      .mockReturnValueOnce(chain({ data: [], error: null }))              // ya notificado
      .mockReturnValueOnce(chain({ data: null, error: null }));           // insert historial

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

  it("skips unsubscribed client", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: [mockCliente], error: null }))
      .mockReturnValueOnce(chain({ data: { desuscrito: true }, error: null }));

    const res = await POST(cronReq());
    expect(res.status).toBe(200);
    expect((await res.json()).enviados).toBe(0);
    expect(mockEnviarEmail).not.toHaveBeenCalled();
  });

  it("returns 500 on clientes DB error", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: "DB error" } }));
    const res = await POST(cronReq());
    expect(res.status).toBe(500);
  });
});
