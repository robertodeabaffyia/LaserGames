/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, PUT } from "../route";

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
  for (const m of ["select", "update", "eq", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const mockConfig = {
  id: 1,
  hora_inicio_reservas: "18:00:00",
  hora_fin_reservas: "23:00:00",
  duracion_bloque_min: 90,
  sena_minima: 1000,
  recargo_transferencia_pct: 2.5,
  precio_sala_completa: 30000,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};

function req(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/escape/config", {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/escape/config", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns the singleton config", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValue(chain({ data: mockConfig, error: null }));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.duracion_bloque_min).toBe(90);
    expect(body.recargo_transferencia_pct).toBe(2.5);
  });

  it("returns 404 when no config row exists", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValue(
      chain({ data: null, error: { message: "No rows", code: "PGRST116" } })
    );

    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns 500 on DB error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValue(
      chain({ data: null, error: { message: "Connection failed", code: "500" } })
    );

    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("PUT /api/escape/config", () => {
  const validBody = {
    hora_inicio_reservas: "18:00",
    hora_fin_reservas: "23:00",
    duracion_bloque_min: 90,
    sena_minima: 1000,
    recargo_transferencia_pct: 2.5,
    precio_sala_completa: 30000,
  };

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const res = await PUT(req("PUT", validBody));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "supervisor" }, error: null }));

    const res = await PUT(req("PUT", validBody));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/administrador/);
  });

  it("updates config and returns 200 for admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    const updateChain = chain({ data: mockConfig, error: null });
    mockFrom
      .mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }))
      .mockReturnValueOnce(updateChain);

    const res = await PUT(req("PUT", validBody));
    expect(res.status).toBe(200);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        hora_inicio_reservas: "18:00",
        hora_fin_reservas: "23:00",
        duracion_bloque_min: 90,
        sena_minima: 1000,
        recargo_transferencia_pct: 2.5,
        precio_sala_completa: 30000,
      })
    );
  });

  it("returns 400 when hora_inicio_reservas is missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }));

    const res = await PUT(req("PUT", { ...validBody, hora_inicio_reservas: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when duracion_bloque_min is not positive", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }));

    const res = await PUT(req("PUT", { ...validBody, duracion_bloque_min: 0 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when sena_minima is negative", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }));

    const res = await PUT(req("PUT", { ...validBody, sena_minima: -1 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when recargo_transferencia_pct is negative", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }));

    const res = await PUT(req("PUT", { ...validBody, recargo_transferencia_pct: -1 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when precio_sala_completa is negative", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }));

    const res = await PUT(req("PUT", { ...validBody, precio_sala_completa: -1 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom.mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }));

    const badReq = new NextRequest("http://localhost/api/escape/config", {
      method: "PUT",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(badReq);
    expect(res.status).toBe(400);
  });

  it("returns 400 on DB error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockFrom
      .mockReturnValueOnce(chain({ data: { rol: "admin" }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: "DB error" } }));

    const res = await PUT(req("PUT", validBody));
    expect(res.status).toBe(400);
  });
});
