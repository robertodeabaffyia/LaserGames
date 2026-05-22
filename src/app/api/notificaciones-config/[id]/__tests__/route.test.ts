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

const ID = "cfg-1";
const params = { params: Promise.resolve({ id: ID }) };

const mockConfig = {
  id: ID,
  tipo: "evento_recordatorio",
  descripcion: "Recordatorio",
  habilitada: true,
  canal: "ambos",
  dias_anticipacion: 1,
  contenido_template: "Hola {{nombre_cliente}}",
  variables_disponibles: ["nombre_cliente"],
};

function req(method: string, body?: unknown) {
  return new NextRequest(`http://localhost/api/notificaciones-config/${ID}`, {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/notificaciones-config/[id]", () => {
  it("returns 200 with config", async () => {
    mockFrom.mockReturnValue(chain({ data: mockConfig, error: null }));
    const res = await GET(req("GET"), params);
    expect(res.status).toBe(200);
    expect((await res.json()).tipo).toBe("evento_recordatorio");
  });

  it("returns 404 when not found", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Not found", code: "PGRST116" } }));
    const res = await GET(req("GET"), params);
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/notificaciones-config/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await PUT(req("PUT", { habilitada: false }), params);
    expect(res.status).toBe(401);
  });

  it("returns 200 with updated config", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValue(chain({ data: { ...mockConfig, habilitada: false }, error: null }));
    const res = await PUT(req("PUT", { habilitada: false }), params);
    expect(res.status).toBe(200);
    expect((await res.json()).habilitada).toBe(false);
  });

  it("returns 400 when canal is invalid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const res = await PUT(req("PUT", { canal: "telegram" }), params);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/canal/);
  });

  it("returns 400 when dias_anticipacion is negative", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const res = await PUT(req("PUT", { dias_anticipacion: -2 }), params);
    expect(res.status).toBe(400);
  });

  it("returns 404 when config not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Not found", code: "PGRST116" } }));
    const res = await PUT(req("PUT", { habilitada: false }), params);
    expect(res.status).toBe(404);
  });

  it("returns 400 on invalid JSON", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const badReq = new NextRequest(`http://localhost/api/notificaciones-config/${ID}`, {
      method: "PUT", body: "bad", headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(badReq, params);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/notificaciones-config/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(401);
  });

  it("returns 204 on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValue(chain({ data: null, error: null }));
    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(204);
  });

  it("returns 400 on DB error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "FK constraint" } }));
    const res = await DELETE(req("DELETE"), params);
    expect(res.status).toBe(400);
  });
});
