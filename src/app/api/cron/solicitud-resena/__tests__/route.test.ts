/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { POST } from "../route";

// ── Supabase mock ─────────────────────────────────────────────────────────────
const mockFrom = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

// ── Notificaciones mock ───────────────────────────────────────────────────────
const mockEnviarEmail    = jest.fn().mockResolvedValue({ ok: true });
const mockEnviarWhatsApp = jest.fn().mockResolvedValue({ ok: true });
jest.mock("@/lib/notificaciones", () => ({
  renderTemplate: (t: string, v: Record<string, string>) =>
    t.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => v[k] ?? `{{${k}}}`),
  enviarEmail:    (...args: unknown[]) => mockEnviarEmail(...args),
  enviarWhatsApp: (...args: unknown[]) => mockEnviarWhatsApp(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "insert", "eq", "gte", "lte", "limit", "single", "maybeSingle"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

function cronReq(withSecret = false) {
  process.env.CRON_SECRET = withSecret ? "secret123" : "";
  return new NextRequest("http://localhost/api/cron/solicitud-resena", {
    method: "POST",
    headers: withSecret ? { authorization: "Bearer secret123" } : {},
  });
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
const mockConfig = {
  id: "cfg-resena",
  tipo: "solicitud_resena",
  habilitada: true,
  canal: "whatsapp",
  dias_anticipacion: 2,
  descripcion: "Solicitud de reseña",
  contenido_template:
    "Hola {{nombre_cliente}}, ¿cómo estuvo el cumple de {{nombre_festejado}}? Dejanos tu reseña: {{link_resena}}",
};

const mockConfiguracion = { google_maps_url: "https://maps.google.com/?cid=123" };

const mockEvento = {
  id: "evt-1",
  nombre_festejado: "Mateo",
  fecha_evento: "2026-05-23T15:00:00Z",
  cliente: { id: "cli-1", nombre: "Laura", email: "laura@test.com", telefono: "+5491111111111" },
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = "";
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/cron/solicitud-resena", () => {
  it("returns 401 when CRON_SECRET set and auth header is missing", async () => {
    process.env.CRON_SECRET = "secret123";
    const req = new NextRequest("http://localhost/api/cron/solicitud-resena", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns early with mensaje when config is disabled or missing", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { message: "no row" } }));

    const res = await POST(cronReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mensaje).toMatch(/deshabilitada/);
    expect(body.enviados).toBe(0);
  });

  it("sends WhatsApp when canal=whatsapp and logs to historial", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))          // notificaciones_config
      .mockReturnValueOnce(chain({ data: mockConfiguracion, error: null }))  // configuraciones
      .mockReturnValueOnce(chain({ data: [mockEvento], error: null }))       // eventos
      .mockReturnValueOnce(chain({ data: [], error: null }))                 // yaEnviado check
      .mockReturnValueOnce(chain({ data: null, error: null }))               // desuscripto
      .mockReturnValue(chain({ data: {}, error: null }));                    // historial insert

    const res = await POST(cronReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enviados).toBe(1);
    expect(mockEnviarWhatsApp).toHaveBeenCalledWith(
      "+5491111111111",
      expect.stringContaining("maps.google.com")
    );
    expect(mockEnviarWhatsApp).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("Mateo")
    );
  });

  it("sends Email when canal=email", async () => {
    const emailConfig = { ...mockConfig, canal: "email" };
    mockFrom
      .mockReturnValueOnce(chain({ data: emailConfig, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfiguracion, error: null }))
      .mockReturnValueOnce(chain({ data: [mockEvento], error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValue(chain({ data: {}, error: null }));

    const res = await POST(cronReq());
    const body = await res.json();
    expect(body.enviados).toBe(1);
    expect(mockEnviarEmail).toHaveBeenCalledWith(
      "laura@test.com",
      "Solicitud de reseña",
      expect.stringContaining("Laura")
    );
  });

  it("sends both channels when canal=ambos", async () => {
    const ambosConfig = { ...mockConfig, canal: "ambos" };
    mockFrom
      .mockReturnValueOnce(chain({ data: ambosConfig, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfiguracion, error: null }))
      .mockReturnValueOnce(chain({ data: [mockEvento], error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValue(chain({ data: {}, error: null }));

    const res = await POST(cronReq());
    const body = await res.json();
    expect(body.enviados).toBe(2);
    expect(mockEnviarWhatsApp).toHaveBeenCalledTimes(1);
    expect(mockEnviarEmail).toHaveBeenCalledTimes(1);
  });

  it("skips events that were already notified (idempotency)", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfiguracion, error: null }))
      .mockReturnValueOnce(chain({ data: [mockEvento], error: null }))
      .mockReturnValueOnce(chain({ data: [{ id: "hist-1" }], error: null })); // yaEnviado = has row

    const res = await POST(cronReq());
    const body = await res.json();
    expect(body.enviados).toBe(0);
    expect(mockEnviarWhatsApp).not.toHaveBeenCalled();
  });

  it("skips unsubscribed clients", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfiguracion, error: null }))
      .mockReturnValueOnce(chain({ data: [mockEvento], error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))               // yaEnviado = empty
      .mockReturnValueOnce(chain({ data: { desuscrito: true }, error: null })); // unsubscribed

    const res = await POST(cronReq());
    const body = await res.json();
    expect(body.enviados).toBe(0);
    expect(mockEnviarWhatsApp).not.toHaveBeenCalled();
  });

  it("uses empty string when google_maps_url is not configured", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: { google_maps_url: null }, error: null }))
      .mockReturnValueOnce(chain({ data: [mockEvento], error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValue(chain({ data: {}, error: null }));

    const res = await POST(cronReq());
    const body = await res.json();
    expect(body.enviados).toBe(1);
    // Template variable stays empty, message still sends
    expect(mockEnviarWhatsApp).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("Laura")
    );
  });

  it("collects errors without aborting the batch", async () => {
    mockEnviarWhatsApp.mockResolvedValueOnce({ ok: false, error: "timeout" });

    const ev2 = {
      ...mockEvento,
      id: "evt-2",
      cliente: { ...mockEvento.cliente, id: "cli-2", telefono: "+5491222222222" },
    };

    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfiguracion, error: null }))
      .mockReturnValueOnce(chain({ data: [mockEvento, ev2], error: null }))
      // evt-1
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValueOnce(chain({ data: {}, error: null }))  // historial
      // evt-2
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValue(chain({ data: {}, error: null }));

    mockEnviarWhatsApp.mockResolvedValueOnce({ ok: true }); // second call ok

    const res = await POST(cronReq());
    const body = await res.json();
    expect(body.errores).toHaveLength(1);
    expect(body.enviados).toBe(1);
  });

  it("returns fecha_objetivo in response", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: mockConfiguracion, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null })); // no events

    const res = await POST(cronReq());
    const body = await res.json();
    expect(body.fecha_objetivo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
