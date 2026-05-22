/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET, POST } from "../route";

const mockFrom = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

function chain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = {};
  for (const m of ["select", "insert", "update", "delete", "eq", "or", "order", "single"]) {
    c[m] = jest.fn().mockReturnValue(c);
  }
  c.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return c;
}

const mockEmpleado = {
  id: "emp-1",
  nombre: "Carlos López",
  dni: "12345678",
  telefono: "555-1234",
  email: "carlos@example.com",
  rol: "general",
  tarifa_horaria: 150,
  fecha_contratacion: "2025-01-15",
  es_activo: true,
  created_at: "2025-01-15T10:00:00Z",
  updated_at: "2025-01-15T10:00:00Z",
};

function req(method: string, url: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

beforeEach(() => jest.clearAllMocks());

describe("GET /api/empleados", () => {
  it("returns list of empleados", async () => {
    mockFrom.mockReturnValue(chain({ data: [mockEmpleado], error: null }));

    const res = await GET(req("GET", "http://localhost/api/empleados"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].nombre).toBe("Carlos López");
  });

  it("passes search query to or() filter", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(req("GET", "http://localhost/api/empleados?q=Carlos"));
    expect(c.or).toHaveBeenCalledWith(
      "nombre.ilike.%Carlos%,telefono.ilike.%Carlos%,dni.ilike.%Carlos%"
    );
  });

  it("filters by activo=true", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(req("GET", "http://localhost/api/empleados?activo=true"));
    expect(c.eq).toHaveBeenCalledWith("es_activo", true);
  });

  it("filters by activo=false", async () => {
    const c = chain({ data: [], error: null });
    mockFrom.mockReturnValue(c);

    await GET(req("GET", "http://localhost/api/empleados?activo=false"));
    expect(c.eq).toHaveBeenCalledWith("es_activo", false);
  });

  it("returns 500 on DB error", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "DB error" } }));

    const res = await GET(req("GET", "http://localhost/api/empleados"));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/empleados", () => {
  const validBody = { nombre: "Carlos López", rol: "general" };

  it("returns 201 with created empleado", async () => {
    mockFrom.mockReturnValue(chain({ data: mockEmpleado, error: null }));

    const res = await POST(req("POST", "http://localhost/api/empleados", validBody));
    expect(res.status).toBe(201);
    expect((await res.json()).nombre).toBe("Carlos López");
  });

  it("returns 400 when nombre is missing", async () => {
    const res = await POST(req("POST", "http://localhost/api/empleados", { rol: "general" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/nombre/);
  });

  it("returns 400 when rol is missing", async () => {
    const res = await POST(req("POST", "http://localhost/api/empleados", { nombre: "Ana" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/rol/);
  });

  it("returns 400 for invalid rol", async () => {
    const res = await POST(
      req("POST", "http://localhost/api/empleados", { nombre: "Ana", rol: "staff" })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/rol must be/);
  });

  it("returns 409 when DNI already exists", async () => {
    mockFrom.mockReturnValue(
      chain({ data: null, error: { message: "Unique violation", code: "23505" } })
    );

    const res = await POST(
      req("POST", "http://localhost/api/empleados", { ...validBody, dni: "12345678" })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/DNI/);
  });

  it("returns 400 on other DB error", async () => {
    mockFrom.mockReturnValue(
      chain({ data: null, error: { message: "Constraint", code: "23000" } })
    );

    const res = await POST(req("POST", "http://localhost/api/empleados", validBody));
    expect(res.status).toBe(400);
  });

  it("returns 400 on invalid JSON", async () => {
    const badReq = new NextRequest("http://localhost/api/empleados", {
      method: "POST",
      body: "bad",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });
});
