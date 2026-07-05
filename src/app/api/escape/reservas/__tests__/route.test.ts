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

// getUserRol is mocked to avoid an extra mockFrom call in every test.
jest.mock("@/lib/auth-helpers", () => {
  const actual = jest.requireActual("@/lib/auth-helpers");
  return { ...actual, getUserRol: jest.fn().mockResolvedValue("supervisor") };
});
import { getUserRol } from "@/lib/auth-helpers";

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "insert", "eq", "is", "order", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const mockConfig = {
  hora_inicio_reservas: "18:00:00",
  hora_fin_reservas: "23:00:00",
  duracion_bloque_min: 90,
  precio_sala_completa: 30000,
};

const mockReserva = {
  id: "r1",
  sala_id: "s1",
  contacto_id: "c1",
  fecha: "2026-07-01",
  hora_inicio: "18:00:00",
  cantidad_personas: 4,
  modo_cobro: "por_persona",
  precio_total: 16000,
  estado: "reservada",
  notas: null,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};

const mockPreciosPersona = [
  { cantidad: 2, precio_por_persona: 5000 },
  { cantidad: 4, precio_por_persona: 4000 },
];

function req(method: string, body?: unknown, url = "http://localhost/api/escape/reservas") {
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

describe("GET /api/escape/reservas", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET(req("GET"));
    expect(res.status).toBe(401);
  });

  it("returns the reservas list", async () => {
    const c = chain({ data: [mockReserva], error: null });
    mockFrom.mockReturnValue(c);

    const res = await GET(req("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });

  it("filters by fecha, sala_id and estado", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(req("GET", undefined, "http://localhost/api/escape/reservas?fecha=2026-07-01&sala_id=s1&estado=reservada"));
    expect(c.eq).toHaveBeenCalledWith("fecha", "2026-07-01");
    expect(c.eq).toHaveBeenCalledWith("sala_id", "s1");
    expect(c.eq).toHaveBeenCalledWith("estado", "reservada");
  });

  it("returns 500 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "DB error" } }));

    const res = await GET(req("GET"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/escape/reservas", () => {
  const validBody = {
    sala_id: "s1",
    contacto_id: "c1",
    fecha: "2026-07-01",
    hora_inicio: "18:00",
    cantidad_personas: 4,
    modo_cobro: "por_persona",
  };

  // escape_precios_persona is only queried for modo 'por_persona' — the route
  // skips that lookup entirely for 'sala_completa', so the mock queue must
  // match exactly or leftover entries corrupt the next test's from() calls.
  function setupHappyPath(reservasExistentes: unknown[] = [], modoCobro: string = "por_persona") {
    const insertChain = chain({ data: mockReserva, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null })) // escape_config
      .mockReturnValueOnce(chain({ data: reservasExistentes, error: null })); // existing reservas
    if (modoCobro === "por_persona") {
      mockFrom.mockReturnValueOnce(chain({ data: mockPreciosPersona, error: null })); // precios_persona
    }
    mockFrom.mockReturnValueOnce(insertChain); // insert
    return insertChain;
  }

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(req("POST", validBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-supervisor user", async () => {
    (getUserRol as jest.Mock).mockResolvedValueOnce("general");

    const res = await POST(req("POST", validBody));
    expect(res.status).toBe(403);
  });

  it("creates a reserva for a supervisor with a valid available slot", async () => {
    setupHappyPath();

    const res = await POST(req("POST", validBody));
    expect(res.status).toBe(201);
  });

  it("creates a reserva for an admin", async () => {
    (getUserRol as jest.Mock).mockResolvedValueOnce("admin");
    setupHappyPath();

    const res = await POST(req("POST", validBody));
    expect(res.status).toBe(201);
  });

  it("recomputes precio_total server-side instead of trusting the client", async () => {
    const insertChain = setupHappyPath();

    await POST(req("POST", { ...validBody, precio_total: 999999 }));
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ precio_total: 16000 })
    );
  });

  it("uses precio_sala_completa for modo sala_completa, ignoring cantidad_personas", async () => {
    const insertChain = setupHappyPath([], "sala_completa");

    await POST(req("POST", { ...validBody, modo_cobro: "sala_completa", cantidad_personas: 6 }));
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ precio_total: 30000 })
    );
  });

  it("rejects a slot that's already booked (409)", async () => {
    // Returns early after the reservas fetch — only 2 from() calls happen,
    // so only 2 mocks may be queued (a 409 never reaches precios/insert).
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(
        chain({
          data: [{ sala_id: "s1", fecha: "2026-07-01", hora_inicio: "18:00:00", estado: "reservada" }],
          error: null,
        })
      );

    const res = await POST(req("POST", validBody));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/no está disponible/);
  });

  it("allows the slot when the conflicting reservation is cancelled", async () => {
    setupHappyPath([
      { sala_id: "s1", fecha: "2026-07-01", hora_inicio: "18:00:00", estado: "cancelada" },
    ]);

    const res = await POST(req("POST", validBody));
    expect(res.status).toBe(201);
  });

  it("returns 400 for por_persona with cantidad_personas outside 2..10", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }));

    const res = await POST(req("POST", { ...validBody, cantidad_personas: 1 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when no per-person price is configured for that cantidad", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: [{ cantidad: 2, precio_por_persona: 5000 }], error: null }));

    const res = await POST(req("POST", { ...validBody, cantidad_personas: 7 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/No hay precio configurado/);
  });

  it("returns 400 when sala_id is missing", async () => {
    const res = await POST(req("POST", { ...validBody, sala_id: undefined }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when contacto_id is missing", async () => {
    const res = await POST(req("POST", { ...validBody, contacto_id: undefined }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a malformed fecha", async () => {
    const res = await POST(req("POST", { ...validBody, fecha: "01-07-2026" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid modo_cobro", async () => {
    const res = await POST(req("POST", { ...validBody, modo_cobro: "gratis" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a non-positive cantidad_personas", async () => {
    const res = await POST(req("POST", { ...validBody, cantidad_personas: 0 }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when escape_config has no row", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: { code: "PGRST116" } }));

    const res = await POST(req("POST", validBody));
    expect(res.status).toBe(404);
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest("http://localhost/api/escape/reservas", {
      method: "POST",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });

  it("returns 400 on DB error during insert", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: mockConfig, error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ data: mockPreciosPersona, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: "DB error" } }));

    const res = await POST(req("POST", validBody));
    expect(res.status).toBe(400);
  });
});
