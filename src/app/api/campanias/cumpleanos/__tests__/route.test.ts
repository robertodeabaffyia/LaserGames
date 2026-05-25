/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

// ── Supabase mock ─────────────────────────────────────────────────────────────
const mockFrom = jest.fn();
const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() =>
    Promise.resolve({ from: mockFrom, auth: { getUser: mockGetUser } })
  ),
}));

// ── Auth-helpers mock ─────────────────────────────────────────────────────────
jest.mock("@/lib/auth-helpers", () => ({
  ...jest.requireActual("@/lib/auth-helpers"),
  getUserRol: jest.fn().mockResolvedValue("supervisor"),
}));

// ── Notification senders mock ─────────────────────────────────────────────────
// renderTemplate is a pure string function — implement inline to avoid pulling in
// Vonage/Resend (ESM-only packages that cannot be required in Jest's CJS context)
jest.mock("@/lib/notificaciones", () => ({
  renderTemplate: (template: string, vars: Record<string, string>) =>
    template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`),
  enviarWhatsApp: jest.fn().mockResolvedValue({ ok: true }),
  enviarEmail: jest.fn().mockResolvedValue({ ok: true }),
}));

import { enviarWhatsApp, enviarEmail } from "@/lib/notificaciones";

// ── Chain helper ──────────────────────────────────────────────────────────────
function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  const methods = ["select", "insert", "in", "eq", "gte", "maybeSingle", "single"];
  for (const m of methods) c[m] = jest.fn().mockReturnValue(c);
  c.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return c;
}

function req(method: string, body?: unknown, search = "") {
  return new NextRequest(`http://localhost/api/campanias/cumpleanos${search}`, {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
const mockHijoWithCliente = {
  id: "hij-1",
  nombre: "Lucas",
  fecha_nacimiento: "2020-08-15", // birthday Aug 15
  cliente_id: "cli-1",
  clientes: {
    id: "cli-1",
    nombre: "María García",
    telefono: "+5491112345678",
    email: "maria@example.com",
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/campanias/cumpleanos", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(req("GET"));
    expect(res.status).toBe(401);
  });

  it("returns empty targets when no hijos match the window", async () => {
    // Return a hijo whose birthday is 200 days away — outside default 60-day window
    const farBirthday = new Date();
    farBirthday.setDate(farBirthday.getDate() + 200);
    const mm = String(farBirthday.getMonth() + 1).padStart(2, "0");
    const dd = String(farBirthday.getDate()).padStart(2, "0");
    const farHijo = { ...mockHijoWithCliente, fecha_nacimiento: `2020-${mm}-${dd}` };

    mockFrom
      .mockReturnValueOnce(chain({ data: [farHijo], error: null })) // hijos
      .mockReturnValueOnce(chain({ data: [], error: null }));        // eventos activos

    const res = await GET(req("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.targets).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("returns targets sorted by days_until_birthday ascending", async () => {
    // Two hijos: one in 5 days, one in 30 days
    const soon = new Date(); soon.setDate(soon.getDate() + 5);
    const later = new Date(); later.setDate(later.getDate() + 30);
    const fmtDate = (d: Date) =>
      `2020-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const hijo1 = { ...mockHijoWithCliente, id: "hij-1", fecha_nacimiento: fmtDate(soon) };
    const hijo2 = {
      ...mockHijoWithCliente,
      id: "hij-2",
      nombre: "Pedro",
      cliente_id: "cli-2",
      clientes: { id: "cli-2", nombre: "Juan", telefono: "+5491198765432", email: null },
      fecha_nacimiento: fmtDate(later),
    };

    mockFrom
      .mockReturnValueOnce(chain({ data: [hijo2, hijo1], error: null })) // unsorted from DB
      .mockReturnValueOnce(chain({ data: [], error: null }));            // no eventos

    const res = await GET(req("GET"));
    const body = await res.json();
    expect(body.targets[0].hijo_id).toBe("hij-1"); // the sooner one first
    expect(body.targets[1].hijo_id).toBe("hij-2");
  });

  it("flags tiene_evento_futuro for clients with active bookings", async () => {
    const soon = new Date(); soon.setDate(soon.getDate() + 10);
    const fmtDate = (d: Date) =>
      `2020-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const hijo = { ...mockHijoWithCliente, fecha_nacimiento: fmtDate(soon) };

    mockFrom
      .mockReturnValueOnce(chain({ data: [hijo], error: null }))             // hijos
      .mockReturnValueOnce(chain({ data: [{ cliente_id: "cli-1" }], error: null })); // evento activo

    const res = await GET(req("GET"));
    const body = await res.json();
    expect(body.targets[0].tiene_evento_futuro).toBe(true);
  });

  it("respects custom ?dias query param", async () => {
    // Hijo with birthday 20 days away — should appear with dias=30 but not dias=10
    const d20 = new Date(); d20.setDate(d20.getDate() + 20);
    const fmtDate = (d: Date) =>
      `2020-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const hijo = { ...mockHijoWithCliente, fecha_nacimiento: fmtDate(d20) };

    // dias=10 → should return 0 targets
    mockFrom
      .mockReturnValueOnce(chain({ data: [hijo], error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }));

    const res = await GET(req("GET", undefined, "?dias=10"));
    const body = await res.json();
    expect(body.total).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/campanias/cumpleanos", () => {
  const validBody = {
    hijo_ids: ["hij-1"],
    template: "Hola {{nombre_cliente}}, el cumple de {{nombre_hijo}} se acerca!",
    canal: "whatsapp",
  };

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req("POST", validBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 for general users", async () => {
    const { getUserRol } = jest.requireMock("@/lib/auth-helpers");
    getUserRol.mockResolvedValueOnce("general");

    mockFrom.mockReturnValue(chain({ data: [], error: null }));
    const res = await POST(req("POST", validBody));
    expect(res.status).toBe(403);
  });

  it("returns 400 when hijo_ids is empty", async () => {
    mockFrom.mockReturnValue(chain({ data: [], error: null }));
    const res = await POST(req("POST", { ...validBody, hijo_ids: [] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/hijo_ids/);
  });

  it("returns 400 when template is missing", async () => {
    mockFrom.mockReturnValue(chain({ data: [], error: null }));
    const res = await POST(req("POST", { hijo_ids: ["h1"], canal: "whatsapp" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/template/);
  });

  it("returns 400 when canal is invalid", async () => {
    mockFrom.mockReturnValue(chain({ data: [], error: null }));
    const res = await POST(req("POST", { ...validBody, canal: "sms" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/canal/);
  });

  it("sends WhatsApp and logs to historial when canal=whatsapp", async () => {
    const insertChain = chain({ data: {}, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: [mockHijoWithCliente], error: null })) // select hijos
      .mockReturnValueOnce(chain({ data: null, error: null }))                  // desuscripciones
      .mockReturnValue(insertChain);                                             // historial insert

    const res = await POST(req("POST", validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enviados).toBe(1);
    expect(body.errores).toHaveLength(0);
    expect(enviarWhatsApp).toHaveBeenCalledWith(
      "+5491112345678",
      expect.stringContaining("María García")
    );
  });

  it("sends Email when canal=email", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: [mockHijoWithCliente], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValue(chain({ data: {}, error: null }));

    const res = await POST(req("POST", { ...validBody, canal: "email" }));
    expect(res.status).toBe(200);
    expect(enviarEmail).toHaveBeenCalledWith(
      "maria@example.com",
      expect.stringContaining("Lucas"),
      expect.any(String)
    );
  });

  it("sends both WA and email when canal=ambos", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: [mockHijoWithCliente], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValue(chain({ data: {}, error: null }));

    const res = await POST(req("POST", { ...validBody, canal: "ambos" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.enviados).toBe(2); // 1 WA + 1 email
    expect(enviarWhatsApp).toHaveBeenCalledTimes(1);
    expect(enviarEmail).toHaveBeenCalledTimes(1);
  });

  it("omits desuscribed clients and increments omitidos", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: [mockHijoWithCliente], error: null }))
      .mockReturnValueOnce(chain({ data: { desuscrito: true }, error: null }));

    const res = await POST(req("POST", validBody));
    const body = await res.json();
    expect(body.enviados).toBe(0);
    expect(body.omitidos).toBe(1);
    expect(enviarWhatsApp).not.toHaveBeenCalled();
  });

  it("collects errors without aborting the rest of the batch", async () => {
    (enviarWhatsApp as jest.Mock).mockResolvedValueOnce({ ok: false, error: "WA error" });

    const hijo2 = {
      ...mockHijoWithCliente,
      id: "hij-2",
      nombre: "Ana",
      clientes: { ...mockHijoWithCliente.clientes, id: "cli-2", nombre: "Pedro" },
    };

    mockFrom
      .mockReturnValueOnce(chain({ data: [mockHijoWithCliente, hijo2], error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null })) // desuscripcion hij-1
      .mockReturnValueOnce(chain({ data: {}, error: null }))  // historial hij-1
      .mockReturnValueOnce(chain({ data: null, error: null })) // desuscripcion hij-2
      .mockReturnValue(chain({ data: {}, error: null }));

    // Restore ok for second call
    (enviarWhatsApp as jest.Mock).mockResolvedValueOnce({ ok: true });

    const res = await POST(req("POST", { ...validBody, hijo_ids: ["hij-1", "hij-2"] }));
    const body = await res.json();
    expect(body.errores).toHaveLength(1);
    expect(body.enviados).toBe(1);
  });
});
