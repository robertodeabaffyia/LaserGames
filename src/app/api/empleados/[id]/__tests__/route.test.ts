/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, PUT, DELETE } from "../route";

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
    getUserRol: jest.fn().mockResolvedValue("admin"),
  };
});

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "insert", "update", "delete", "eq", "order", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const ID = "emp-1";
const params = { params: Promise.resolve({ id: ID }) };

function req(method: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/empleados/${ID}`, {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

const mockEmpleado = {
  id: ID,
  nombre: "Carlos López",
  rol: "general",
  es_activo: true,
  registros_horas: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("GET /api/empleados/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(req("GET"), params);
    expect(res.status).toBe(401);
  });

  it("returns 200 with empleado and registros_horas", async () => {
    mockFrom.mockReturnValue(chain({ data: mockEmpleado, error: null }));

    const res = await GET(req("GET"), params);
    expect(res.status).toBe(200);
    expect((await res.json()).nombre).toBe("Carlos López");
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

describe("PUT /api/empleados/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await PUT(req("PUT", { nombre: "X" }), params);
    expect(res.status).toBe(401);
  });

  it("returns 200 with updated empleado (no rol field)", async () => {
    const updated = { ...mockEmpleado, nombre: "Carlos M." };
    mockFrom.mockReturnValue(chain({ data: updated, error: null }));

    const res = await PUT(req("PUT", { nombre: "Carlos M." }), params);
    expect(res.status).toBe(200);
    expect((await res.json()).nombre).toBe("Carlos M.");
  });

  it("returns 400 for invalid rol value", async () => {
    const res = await PUT(req("PUT", { rol: "becario" }), params);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/rol must be/);
  });

  it("allows admin to change rol", async () => {
    mockFrom.mockReturnValue(chain({ data: { ...mockEmpleado, rol: "supervisor" }, error: null }));

    const res = await PUT(req("PUT", { rol: "supervisor" }), params);
    expect(res.status).toBe(200);
  });

  it("returns 403 when non-admin tries to change rol", async () => {
    const { getUserRol } = jest.requireMock("@/lib/auth-helpers");
    (getUserRol as jest.Mock).mockResolvedValueOnce("supervisor");

    const res = await PUT(req("PUT", { rol: "general" }), params);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/administrador/i);
  });

  it("returns 409 when DNI conflict on update", async () => {
    mockFrom.mockReturnValue(
      chain({ data: null, error: { message: "Unique", code: "23505" } })
    );

    const res = await PUT(req("PUT", { dni: "99999999" }), params);
    expect(res.status).toBe(409);
  });

  it("returns 404 when not found", async () => {
    mockFrom.mockReturnValue(
      chain({ data: null, error: { message: "Not found", code: "PGRST116" } })
    );

    const res = await PUT(req("PUT", { nombre: "X" }), params);
    expect(res.status).toBe(404);
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest(`http://localhost/api/empleados/${ID}`, {
      method: "PUT",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(badReq, params);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/empleados/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(401);
  });

  it("returns 204 on successful soft-delete", async () => {
    const updateChain = chain({ data: null, error: null });
    mockFrom.mockReturnValue(updateChain);

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(204);
    expect(updateChain.update).toHaveBeenCalledWith({ es_activo: false });
  });

  it("returns 400 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "FK error" } }));

    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(400);
  });
});
