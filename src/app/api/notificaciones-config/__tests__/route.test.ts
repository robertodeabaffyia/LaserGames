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

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "insert", "update", "delete", "eq", "order", "single", "limit"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const mockConfig = {
  id: "cfg-1",
  tipo: "evento_recordatorio",
  descripcion: "Recordatorio de evento",
  habilitada: true,
  canal: "ambos",
  dias_anticipacion: 1,
  contenido_template: "Hola {{nombre_cliente}}",
  variables_disponibles: ["nombre_cliente"],
  creado_por: null,
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

function postReq(body: unknown) {
  return new NextRequest("http://localhost/api/notificaciones-config", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/notificaciones-config", () => {
  it("returns 200 with list", async () => {
    mockFrom.mockReturnValue(chain({ data: [mockConfig], error: null }));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].tipo).toBe("evento_recordatorio");
  });

  it("returns 500 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "DB error" } }));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("POST /api/notificaciones-config", () => {
  const validBody = {
    tipo: "evento_recordatorio",
    descripcion: "Mi recordatorio",
    canal: "email",
    contenido_template: "Hola {{nombre_cliente}}",
    dias_anticipacion: 2,
  };

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(401);
  });

  it("returns 201 with created config", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValue(chain({ data: mockConfig, error: null }));

    const res = await POST(postReq(validBody));
    expect(res.status).toBe(201);
    expect((await res.json()).tipo).toBe("evento_recordatorio");
  });

  it("returns 400 when tipo is invalid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const res = await POST(postReq({ ...validBody, tipo: "invalido" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/tipo/);
  });

  it("returns 400 when descripcion is empty", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const res = await POST(postReq({ ...validBody, descripcion: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/descripcion/);
  });

  it("returns 400 when canal is invalid", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const res = await POST(postReq({ ...validBody, canal: "telegram" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/canal/);
  });

  it("returns 400 when contenido_template is empty", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const res = await POST(postReq({ ...validBody, contenido_template: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/contenido_template/);
  });

  it("returns 400 when dias_anticipacion is negative", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const res = await POST(postReq({ ...validBody, dias_anticipacion: -1 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/dias_anticipacion/);
  });

  it("returns 400 on DB error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "Constraint" } }));
    const res = await POST(postReq(validBody));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    const badReq = new NextRequest("http://localhost/api/notificaciones-config", {
      method: "POST", body: "bad", headers: { "Content-Type": "application/json" },
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });
});
