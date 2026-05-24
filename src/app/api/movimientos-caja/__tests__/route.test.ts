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

// Mock auth-helpers so role checks don't touch the DB
jest.mock("@/lib/auth-helpers", () => {
  const actual = jest.requireActual("@/lib/auth-helpers");
  return {
    ...actual,
    getUserRol: jest.fn().mockResolvedValue("supervisor"),
  };
});

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of [
    "select", "insert", "update", "delete", "eq", "gte", "lte",
    "order", "single", "not", "filter",
  ]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const mockMovimiento = {
  id: "mov-1",
  usuario_id: "user-1",
  tipo: "ingreso",
  categoria: "pago_evento",
  descripcion: "Pago evento ev-1",
  monto: 1500,
  fecha: "2026-05-15",
  es_repetible: false,
  frecuencia_repeticion: null,
  evento_id: "ev-1",
  empleado_id: null,
  created_at: "2026-05-15T10:00:00Z",
};

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/movimientos-caja", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

// ── GET ────────────────────────────────────────────────────────────────────────

describe("GET /api/movimientos-caja", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(new NextRequest("http://localhost/api/movimientos-caja"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is general (insufficient role)", async () => {
    const { getUserRol } = jest.requireMock("@/lib/auth-helpers");
    (getUserRol as jest.Mock).mockResolvedValueOnce("general");
    const res = await GET(new NextRequest("http://localhost/api/movimientos-caja"));
    expect(res.status).toBe(403);
  });

  it("returns 200 with list (no filters)", async () => {
    mockFrom.mockReturnValue(chain({ data: [mockMovimiento], error: null }));

    const res = await GET(new NextRequest("http://localhost/api/movimientos-caja"));
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });

  it("applies mes filter with gte/lte", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(new NextRequest("http://localhost/api/movimientos-caja?mes=2026-05"));
    expect(c.gte).toHaveBeenCalledWith("fecha", "2026-05-01");
    expect(c.lte).toHaveBeenCalledWith("fecha", "2026-05-31");
  });

  it("applies dia filter with eq", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(new NextRequest("http://localhost/api/movimientos-caja?dia=2026-05-15"));
    expect(c.eq).toHaveBeenCalledWith("fecha", "2026-05-15");
  });

  it("applies desde/hasta range filter", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(new NextRequest("http://localhost/api/movimientos-caja?desde=2026-05-01&hasta=2026-05-07"));
    expect(c.gte).toHaveBeenCalledWith("fecha", "2026-05-01");
    expect(c.lte).toHaveBeenCalledWith("fecha", "2026-05-07");
  });

  it("applies tipo filter with eq", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(new NextRequest("http://localhost/api/movimientos-caja?tipo=egreso"));
    expect(c.eq).toHaveBeenCalledWith("tipo", "egreso");
  });

  it("applies categoria filter with eq", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(new NextRequest("http://localhost/api/movimientos-caja?categoria=salario"));
    expect(c.eq).toHaveBeenCalledWith("categoria", "salario");
  });

  it("returns 500 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "DB error" } }));

    const res = await GET(new NextRequest("http://localhost/api/movimientos-caja"));
    expect(res.status).toBe(500);
  });
});

// ── POST ───────────────────────────────────────────────────────────────────────

describe("POST /api/movimientos-caja", () => {
  const validBody = {
    tipo: "egreso",
    categoria: "compras",
    descripcion: "Compra de insumos",
    monto: 500,
  };

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is general", async () => {
    const { getUserRol } = jest.requireMock("@/lib/auth-helpers");
    (getUserRol as jest.Mock).mockResolvedValueOnce("general");

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(403);
  });

  it("returns 201 with created movimiento", async () => {
    mockFrom.mockReturnValue(chain({ data: mockMovimiento, error: null }));

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.tipo).toBe("ingreso"); // from mock
    expect(mockFrom).toHaveBeenCalledWith("movimientos_caja");
  });

  it("returns 400 when tipo is invalid", async () => {
    const res = await POST(postReq({ ...validBody, tipo: "otro" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/tipo/);
  });

  it("returns 400 when categoria is invalid", async () => {
    const res = await POST(postReq({ ...validBody, categoria: "invalida" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/categoria/);
  });

  it("returns 400 when descripcion is missing", async () => {
    const res = await POST(postReq({ ...validBody, descripcion: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/descripcion/);
  });

  it("returns 400 when monto is 0", async () => {
    const res = await POST(postReq({ ...validBody, monto: 0 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/monto/);
  });

  it("returns 201 with es_repetible and frecuencia_repeticion", async () => {
    const c = chain({ data: { ...mockMovimiento, es_repetible: true, frecuencia_repeticion: "mensual" }, error: null });
    mockFrom.mockReturnValue(c);

    const res = await POST(postReq({ ...validBody, es_repetible: true, frecuencia_repeticion: "mensual" }));
    expect(res.status).toBe(201);
    expect(c.insert).toHaveBeenCalledWith(
      expect.objectContaining({ es_repetible: true, frecuencia_repeticion: "mensual" })
    );
  });

  it("returns 400 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Constraint violation" } }));

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest("http://localhost/api/movimientos-caja", {
      method: "POST",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });
});
